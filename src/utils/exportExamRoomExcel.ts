import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${hh}:${mm} ${dd}/${MM}/${yyyy}`
}

function formatDuration(duration: number | null | undefined): string {
  if (!duration || duration <= 0) return '0 phút 00 giây'
  const mins = Math.floor(duration / 60)
  const secs = Math.floor(duration % 60)
  return `${mins} phút ${String(secs).padStart(2, '0')} giây`
}

export async function exportExamRoomToExcel(room: {
  id: string
  code: string
  exam_id: string
  class_id?: string | null
  time_limit?: number
  exams?: { title?: string }
  classes?: { class_name?: string }
}) {
  // 1. Lấy thông tin chi tiết phòng thi & đề thi
  const { data: roomData, error: roomError } = await supabase
    .from('exam_rooms')
    .select('*, exams(title, data), classes(class_name)')
    .eq('id', room.id)
    .single()

  if (roomError) {
    throw new Error('Không thể tải thông tin phòng thi: ' + roomError.message)
  }

  const examTitle = roomData?.exams?.title || room.exams?.title || 'Đề thi'
  const examData = roomData?.exams?.data
  const className =
    roomData?.classes?.class_name ||
    room.classes?.class_name ||
    'Tất cả'
  const timeLimit = roomData?.time_limit ?? room.time_limit ?? 45

  // 2. Lấy danh sách bài nộp của học sinh
  const { data: subsData, error: subsError } = await supabase
    .from('exam_submissions')
    .select('*, students(id, full_name, student_code)')
    .eq('room_id', room.id)
    .order('submitted_at', { ascending: false })

  if (subsError) {
    throw new Error('Không thể tải danh sách bài nộp: ' + subsError.message)
  }

  const rawSubs = subsData || []
  // Lọc các bài làm hợp lệ (bài có điểm khác 0 hoặc đã submit)
  const activeSubs = rawSubs.filter((s: any) => s.score !== 0 || s.status === 'submitted')

  // 3. Lấy danh sách học sinh theo lớp để tìm ai chưa nộp
  let notSubmittedStudents: any[] = []
  if (roomData?.class_id || room.class_id) {
    const classId = roomData?.class_id || room.class_id
    const { data: enrolledStudents } = await supabase
      .from('enrollments')
      .select('student_id, students(id, full_name, student_code)')
      .eq('class_id', classId)
      .eq('status', 'active')

    if (enrolledStudents) {
      const activeStudentIds = new Set(activeSubs.map((s: any) => s.student_id))
      notSubmittedStudents = enrolledStudents
        .filter((e: any) => !activeStudentIds.has(e.student_id))
        .map((e: any) => e.students)
        .filter(Boolean)

      // Sắp xếp học sinh chưa làm theo tên
      notSubmittedStudents.sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '', 'vi')
      )
    }
  }

  // 4. Chuẩn bị dữ liệu học sinh đã nộp
  const examQuestions = examData?.questions || []

  const formattedSubmitted = activeSubs.map((sub: any) => {
    const sb = sub.score_breakdown || {}
    const historyTabSwitches = (sb.history || []).reduce(
      (sum: number, att: any) => sum + (att.tab_switches || 0),
      0
    )
    const totalTabSwitches = (sub.tab_switches || 0) + historyTabSwitches

    const mcCorrect = sb.multipleChoice?.correct || 0
    const tfCorrect = sb.trueFalse?.correct || 0
    const saCorrect = sb.shortAnswer?.correct || 0
    const computedCorrectCount = mcCorrect + tfCorrect + saCorrect

    const totalQCount =
      examQuestions.length ||
      (sb.multipleChoice?.total || 0) +
        (sb.trueFalse?.total || 0) +
        (sb.shortAnswer?.total || 0) ||
      0

    const scoreNum =
      typeof sub.score === 'number'
        ? Math.round(sub.score * 100) / 100
        : Number(sub.score || 0)

    return {
      studentCode: sub.students?.student_code || '—',
      studentName: sub.students?.full_name || '—',
      score: scoreNum,
      correctCount: sub.correct_count ?? computedCorrectCount,
      totalQuestions: totalQCount,
      attemptCount: sb.attempt_count || 1,
      tabSwitches: totalTabSwitches,
      duration: sub.duration || 0,
      status: sub.status === 'submitted' ? 'Đã nộp bài' : 'Đang làm bài',
      submittedAt: sub.submitted_at
    }
  })

  // Sắp xếp học sinh đã nộp theo điểm giảm dần
  formattedSubmitted.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.duration || 0) - (b.duration || 0)
  })

  const totalStudents = formattedSubmitted.length + notSubmittedStudents.length
  const submittedCount = formattedSubmitted.length
  const notSubmittedCount = notSubmittedStudents.length
  const exportDateStr = formatDate(new Date())

  // 5. Xây dựng các hàng (Rows) cho Sheet Excel
  const rows: any[][] = []

  // Tiêu đề & Thông tin chung
  rows.push(['BẢNG ĐIỂM VÀ KẾT QUẢ THI CHI TIẾT'])
  rows.push([`Tên đề thi: ${examTitle}`])
  rows.push([`Mã phòng thi: ${room.code}  |  Lớp: ${className}  |  Thời gian làm bài: ${timeLimit} phút`])
  rows.push([
    `Ngày xuất file: ${exportDateStr}  |  Tổng số học sinh: ${totalStudents} (Đã nộp: ${submittedCount}, Chưa làm: ${notSubmittedCount})`
  ])
  rows.push([]) // Dòng trống ngăn cách

  // Header bảng dữ liệu
  rows.push([
    'STT (Xếp hạng)',
    'Mã học sinh',
    'Họ và tên',
    'Lớp',
    'Điểm số',
    'Số câu đúng',
    'Số lần thi',
    'Số lần vi phạm (Chuyển tab)',
    'Tổng thời gian làm bài',
    'Trạng thái',
    'Thời gian nộp bài'
  ])

  // Danh sách học sinh đã hoàn thành
  formattedSubmitted.forEach((sub, idx) => {
    rows.push([
      idx + 1,
      sub.studentCode,
      sub.studentName,
      className,
      sub.score,
      `${sub.correctCount}/${sub.totalQuestions}`,
      sub.attemptCount,
      sub.tabSwitches,
      formatDuration(sub.duration),
      sub.status,
      formatDate(sub.submittedAt)
    ])
  })

  // Danh sách học sinh chưa làm bài
  notSubmittedStudents.forEach((student: any) => {
    rows.push([
      '—',
      student.student_code || '—',
      student.full_name || '—',
      className,
      'Chưa làm',
      'Chưa làm',
      'Chưa làm',
      'Chưa làm',
      'Chưa làm',
      'Chưa làm bài',
      '—'
    ])
  })

  // Dòng trống trước phần thống kê
  rows.push([])

  // Tính toán số liệu thống kê
  const scores = formattedSubmitted.map((s) => s.score)
  const maxScoreStr = scores.length > 0 ? Math.max(...scores).toFixed(2) : '0.00'
  const minScoreStr = scores.length > 0 ? Math.min(...scores).toFixed(2) : '0.00'
  const avgScoreStr =
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      : '0.00'
  const submittedPct =
    totalStudents > 0 ? ((submittedCount / totalStudents) * 100).toFixed(1) : '0.0'
  const passCount = scores.filter((s) => s >= 5).length
  const passPct =
    submittedCount > 0 ? ((passCount / submittedCount) * 100).toFixed(1) : '0.0'

  // Bảng thống kê kết quả
  rows.push(['--- BẢNG THỐNG KÊ KẾT QUẢ ---'])
  rows.push(['Tổng số học sinh trong danh sách:', totalStudents])
  rows.push(['Số học sinh đã hoàn thành:', `${submittedCount} (${submittedPct}%)`])
  rows.push(['Số học sinh chưa làm bài:', notSubmittedCount])
  rows.push(['Điểm cao nhất:', maxScoreStr])
  rows.push(['Điểm thấp nhất:', minScoreStr])
  rows.push(['Điểm trung bình:', avgScoreStr])
  rows.push(['Tỷ lệ học sinh đạt điểm >= 5:', `${passCount}/${submittedCount} (${passPct}%)`])

  // 6. Tạo Workbook & xuất file
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Cấu hình độ rộng cột cho đẹp mắt
  ws['!cols'] = [
    { wch: 16 }, // STT (Xếp hạng)
    { wch: 15 }, // Mã học sinh
    { wch: 28 }, // Họ và tên
    { wch: 15 }, // Lớp
    { wch: 12 }, // Điểm số
    { wch: 15 }, // Số câu đúng
    { wch: 12 }, // Số lần thi
    { wch: 28 }, // Số lần vi phạm (Chuyển tab)
    { wch: 24 }, // Tổng thời gian làm bài
    { wch: 16 }, // Trạng thái
    { wch: 20 }  // Thời gian nộp bài
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bảng điểm chi tiết')

  // Đặt tên file theo mã phòng và tên đề thi
  const cleanTitle = (examTitle || 'PhongThi').replace(/[\\/:*?"<>|]/g, '_').trim()
  const cleanClass = (className || '').replace(/[\\/:*?"<>|]/g, '_').trim()
  const fileName = `BangDiem_${cleanTitle}_${room.code}${cleanClass ? `_${cleanClass}` : ''}.xlsx`

  XLSX.writeFile(wb, fileName)
}
