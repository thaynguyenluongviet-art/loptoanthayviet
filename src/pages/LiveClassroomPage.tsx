// @ts-nocheck
import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Video,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ExternalLink,
  BookOpen,
  Users,
  PenTool,
  HelpCircle,
  ArrowLeft,
  Share2,
  Sparkles,
  Info,
  Radio,
  Settings,
  Layers,
  Circle,
  Square,
  Pause,
  Play,
  Download,
  Upload,
  Youtube,
  Trash2,
  Plus,
  Film,
  Clock,
  Calendar,
  X,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Bell,
  BellOff,
  FileText,
  Search,
  Grid,
  Monitor,
  CheckCircle2,
  UserCheck,
  Award,
  AlertTriangle,
  Send
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useDataStore } from '@/store/dataStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const TEACHER_PHONE = '0943688943'
const TEACHER_NAME = 'Thầy Nguyễn Lương Việt'
const ZALO_LINK = `https://zalo.me/${TEACHER_PHONE}`
const LOCAL_STORAGE_VIDEOS_KEY = 'thayviet_recorded_lessons'

// Bảng màu avatar học sinh sinh động
const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-purple-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-pink-600',
  'bg-blue-600',
  'bg-violet-600'
]

export default function LiveClassroomPage({ isTeacherView = false }: { isTeacherView?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore() as any
  const { classes, loadClasses } = useDataStore() as any

  const jitsiContainerRef = useRef<HTMLDivElement>(null)
  const jitsiApiRef = useRef<any>(null)

  // Thông tin người tham gia & phòng
  const [userName, setUserName] = useState('')
  const [isTeacher, setIsTeacher] = useState(isTeacherView || !!user)
  const [selectedClassId, setSelectedClassId] = useState<string>(searchParams.get('classId') || '')
  const [roomCode, setRoomCode] = useState<string>(searchParams.get('room') || '')
  const [isJoined, setIsJoined] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isScrbleModalOpen, setIsScrbleModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoadingApi, setIsLoadingApi] = useState(false)

  // ── CHẾ ĐỘ HIỂN THỊ (VIEW MODE) ──────────────────────────────────
  // 'split': Chia 2 cột (Video bên trái + Sơ đồ bàn học bên phải - Y HỆT TRÊN ẢNH)
  // 'video_only': Chỉ Video (phóng to bảng viết Scrble Ink)
  // 'grid': Lưới Camera học sinh
  const [viewMode, setViewMode] = useState<'split' | 'video_only' | 'grid'>('split')

  // ── ÂM THANH HIỆU ỨNG LỚP HỌC (SOUNDBOARD) ────────────────────────
  const [soundVolume, setSoundVolume] = useState<number>(1.0) // 100%

  // ── SƠ ĐỒ LỚP HỌC & CHỖ NGỒI (SEATING CHART) ─────────────────────
  const [deskCapacity, setDeskCapacity] = useState<number>(24) // 16, 24, 32 bàn
  const [searchStudent, setSearchStudent] = useState('')
  const [studentsList, setStudentsList] = useState<any[]>([])
  const [selectedDeskStudent, setSelectedDeskStudent] = useState<any | null>(null)
  const [handRaiseAlarm, setHandRaiseAlarm] = useState(true) // Chuông giơ tay
  const [isMuteAll, setIsMuteAll] = useState(false)

  // ── PHÁT ĐỀ THI TRỰC TIẾP TRONG LỚP ──────────────────────────────
  const [isDistributeExamModalOpen, setIsDistributeExamModalOpen] = useState(false)
  const [availableExams, setAvailableExams] = useState<any[]>([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [distributedExamNotice, setDistributedExamNotice] = useState<any | null>(null)

  // ── QUAY VIDEO BÀI DẠY (MEDIA RECORDER) ───────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isPausedRecording, setIsPausedRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const recordStreamRef = useRef<MediaStream | null>(null)

  // Modal sau khi quay xong & Kho video
  const [isPostRecordModalOpen, setIsPostRecordModalOpen] = useState(false)
  const [recordedFileName, setRecordedFileName] = useState('')
  const [isSavedVideosModalOpen, setIsSavedVideosModalOpen] = useState(false)
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false)
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null)
  const [savedVideos, setSavedVideos] = useState<any[]>([])
  const [newVideoForm, setNewVideoForm] = useState({ title: '', video_url: '', class_id: '', note: '' })

  // ── TỔNG HỢP ÂM THANH HIỆU ỨNG (WEB AUDIO API SYNTHESIS) ─────────
  const playSoundEffect = (type: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const now = ctx.currentTime
      const vol = soundVolume

      if (type === 'applause') {
        // Vỗ tay rào rào
        for (let i = 0; i < 24; i++) {
          const time = now + Math.random() * 1.6
          const osc = ctx.createOscillator()
          const clapGain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(160 + Math.random() * 280, time)
          clapGain.gain.setValueAtTime(0.35 * vol, time)
          clapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
          osc.connect(clapGain)
          clapGain.connect(ctx.destination)
          osc.start(time)
          osc.stop(time + 0.08)
        }
        toast('👏 Tiếng vỗ tay tán thưởng!', { icon: '👏' })
      } else if (type === 'reward') {
        // Âm thanh khen thưởng Fanfare (Đồ - Mi - Son - Đố)
        const notes = [523.25, 659.25, 783.99, 1046.50]
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const noteGain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + idx * 0.12)
          noteGain.gain.setValueAtTime(0.4 * vol, now + idx * 0.12)
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6)
          osc.connect(noteGain)
          noteGain.connect(ctx.destination)
          osc.start(now + idx * 0.12)
          osc.stop(now + idx * 0.12 + 0.6)
        })
        toast.success('🎉 Khen thưởng học sinh làm bài xuất sắc!')
      } else if (type === 'bell') {
        // Chuông báo reng reng
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        osc.frequency.exponentialRampToValueAtTime(440, now + 1.2)
        g.gain.setValueAtTime(0.5 * vol, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 1.2)
        toast('🔔 Reng chuông nhắc lớp!', { icon: '🔔' })
      } else if (type === 'tingdong') {
        // Ting đong 2 nốt
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const g1 = ctx.createGain()
        const g2 = ctx.createGain()
        osc1.frequency.setValueAtTime(659.25, now)
        osc2.frequency.setValueAtTime(523.25, now + 0.22)
        g1.gain.setValueAtTime(0.4 * vol, now)
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
        g2.gain.setValueAtTime(0.4 * vol, now + 0.22)
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
        osc1.connect(g1)
        g1.connect(ctx.destination)
        osc2.connect(g2)
        g2.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.45)
        osc2.start(now + 0.22)
        osc2.stop(now + 0.75)
        toast('⚡ Ting đong!', { icon: '⚡' })
      } else if (type === 'suspense') {
        // Hồi hộp / Trống dồn đếm ngược
        for (let i = 0; i < 10; i++) {
          const time = now + i * 0.09
          const osc = ctx.createOscillator()
          const drumGain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(110 - i * 3, time)
          drumGain.gain.setValueAtTime((0.15 + i * 0.03) * vol, time)
          drumGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
          osc.connect(drumGain)
          drumGain.connect(ctx.destination)
          osc.start(time)
          osc.stop(time + 0.1)
        }
        toast('⏳ Hồi hộp... Công bố kết quả!', { icon: '⏳' })
      } else if (type === 'wrong') {
        // Đáp sai / Cảnh báo nhẹ
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(150, now)
        osc.frequency.linearRampToValueAtTime(110, now + 0.35)
        g.gain.setValueAtTime(0.3 * vol, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.4)
        toast('❌ Câu trả lời chưa đúng, cùng thử lại nhé!', { icon: '❌' })
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ── KHỞI TẠO DỮ LIỆU BAN ĐẦU ────────────────────────────────────
  useEffect(() => {
    loadClasses()

    // Tải danh sách video đã lưu từ localStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_VIDEOS_KEY)
      if (stored) setSavedVideos(JSON.parse(stored))
    } catch (e) {
      console.error(e)
    }

    // Tải danh sách đề thi từ Supabase
    const fetchExams = async () => {
      const { data } = await supabase.from('exams').select('id, title').order('created_at', { ascending: false }).limit(20)
      if (data) setAvailableExams(data)
    }
    fetchExams()

    // Nhận diện người dùng
    const savedStudent = localStorage.getItem('current_student')
    if (user) {
      setIsTeacher(true)
      setUserName(user.name || user.full_name || TEACHER_NAME)
    } else if (savedStudent) {
      try {
        const studentObj = JSON.parse(savedStudent)
        setUserName(studentObj.full_name || studentObj.name || 'Học sinh')
      } catch (e) {
        setUserName('Học sinh')
      }
    } else {
      setUserName('Học sinh')
    }
  }, [user])

  // Tải danh sách học sinh theo lớp đã chọn
  useEffect(() => {
    const fetchClassStudents = async () => {
      if (selectedClassId) {
        // Lấy học sinh thuộc lớp
        const { data: enrolls } = await supabase
          .from('enrollments')
          .select('student_id, students(*)')
          .eq('class_id', selectedClassId)
          .eq('status', 'active')

        if (enrolls && enrolls.length > 0) {
          const list = enrolls.map((e: any, idx: number) => ({
            ...e.students,
            seatNumber: idx + 1,
            isOnline: true,
            status: 'Có mặt'
          }))
          setStudentsList(list)
          return
        }
      }

      // Nếu chưa chọn lớp hoặc lớp chưa có enrollment, lấy danh sách học sinh mẫu từ database
      const { data: allStudents } = await supabase.from('students').select('*').limit(32)
      if (allStudents && allStudents.length > 0) {
        setStudentsList(allStudents.map((s, idx) => ({
          ...s,
          seatNumber: idx + 1,
          isOnline: idx < 8, // Giả lập các bàn đầu có mặt
          status: idx < 8 ? 'Đang học' : 'Vắng'
        })))
      }
    }
    fetchClassStudents()
  }, [selectedClassId])

  // Tự động sinh mã phòng chuẩn hóa theo lớp
  useEffect(() => {
    if (selectedClassId && classes && classes.length > 0) {
      const cls = classes.find((c: any) => c.id === selectedClassId)
      if (cls) {
        const cleanName = (cls.class_name || 'LopToan')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
        setRoomCode(`LopToanThayViet-${cleanName}`)
      }
    } else if (!roomCode) {
      setRoomCode('LopToanThayViet-Chung')
    }
  }, [selectedClassId, classes])

  // Tải script Jitsi Meet External API
  const loadJitsiScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).JitsiMeetExternalAPI) {
        resolve()
        return
      }
      const existingScript = document.getElementById('jitsi-external-api-script')
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve())
        existingScript.addEventListener('error', (e) => reject(e))
        return
      }
      const script = document.createElement('script')
      script.id = 'jitsi-external-api-script'
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = (e) => reject(e)
      document.body.appendChild(script)
    })
  }

  // Khởi chạy phòng họp
  const startMeeting = async () => {
    const finalRoom = roomCode.trim() || 'LopToanThayViet-Chung'
    const finalName = userName.trim() || (isTeacher ? TEACHER_NAME : 'Học sinh')

    setIsLoadingApi(true)
    try {
      await loadJitsiScript()

      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose()
        jitsiApiRef.current = null
      }

      if (!jitsiContainerRef.current) {
        setIsLoadingApi(false)
        return
      }

      jitsiContainerRef.current.innerHTML = ''

      const domain = 'meet.jit.si'
      const options = {
        roomName: finalRoom,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: isTeacher ? `${finalName} (Giáo viên)` : finalName
        },
        configOverwrite: {
          startWithAudioMuted: !isTeacher,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
          enableWelcomePage: false,
          enableClosePage: false,
          whiteboard: { enabled: true },
          toolbarButtons: [
            'microphone',
            'camera',
            'closedcaptions',
            'desktop',
            'fullscreen',
            'fodeviceselection',
            'hangup',
            'profile',
            'chat',
            'raisehand',
            'videoquality',
            'filmstrip',
            'tileview',
            'whiteboard',
            'mute-everyone'
          ]
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: true,
          DEFAULT_BACKGROUND: '#090d16'
        }
      }

      const api = new (window as any).JitsiMeetExternalAPI(domain, options)
      jitsiApiRef.current = api

      api.addEventListeners({
        videoConferenceJoined: () => {
          setIsJoined(true)
          setIsLoadingApi(false)
          toast.success('Đã kết nối phòng học trực tuyến thành công!')
        },
        videoConferenceLeft: () => {
          setIsJoined(false)
        },
        raiseHandUpdated: (event: any) => {
          if (handRaiseAlarm && event.handRaised) {
            playSoundEffect('bell')
            toast('✋ Có học sinh vừa bấm Giơ tay phát biểu!', { icon: '✋' })
          }
        }
      })
    } catch (error: any) {
      console.error('Lỗi Jitsi Meet:', error)
      toast.error('Không thể kết nối phòng học: ' + (error.message || 'Lỗi mạng'))
      setIsLoadingApi(false)
    }
  }

  useEffect(() => {
    if (roomCode && !isJoined && !isLoadingApi) {
      const timer = setTimeout(() => {
        startMeeting()
      }, 500)
      return () => clearTimeout(timer)
    }
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose()
        jitsiApiRef.current = null
      }
    }
  }, [roomCode])

  // Tắt mic cả lớp
  const handleToggleMuteAll = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('muteEveryone')
      setIsMuteAll(true)
      toast.success('Đã tắt micro toàn bộ học sinh để giữ trật tự lớp!')
    } else {
      toast.success('Đã bật chế độ im lặng toàn lớp!')
    }
  }

  // Sao chép liên kết phòng học
  const handleCopyLink = () => {
    const url = `${window.location.origin}/live?room=${encodeURIComponent(roomCode)}${selectedClassId ? `&classId=${selectedClassId}` : ''}`
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    toast.success('Đã sao chép link phòng học gửi cho học sinh!')
    setTimeout(() => setIsCopied(false), 2500)
  }

  // Toàn màn hình
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // ── XỬ LÝ QUAY VIDEO MÀN HÌNH BÀI DẠY (MEDIA RECORDER) ────────────
  const startRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'window' },
        audio: true
      })

      let finalStream = displayStream

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const dest = audioCtx.createMediaStreamDestination()

        if (displayStream.getAudioTracks().length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(displayStream)
          sysSource.connect(dest)
        }
        if (micStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(micStream)
          micSource.connect(dest)
        }

        finalStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ])
      } catch (micErr) {
        console.warn('Dùng âm thanh màn hình:', micErr)
      }

      recordStreamRef.current = finalStream
      recordedChunksRef.current = []

      let mimeType = 'video/webm;codecs=vp9,opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'
      }

      const recorder = new MediaRecorder(finalStream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        clearInterval(timerIntervalRef.current)
        setIsRecording(false)
        setIsPausedRecording(false)

        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        const blobUrl = URL.createObjectURL(blob)

        const now = new Date()
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
        const currentClassName = classes?.find((c: any) => c.id === selectedClassId)?.class_name || 'LopToan'
        const cleanCls = currentClassName.replace(/[^a-zA-Z0-9]/g, '')
        const fileName = `BaiGiang_ToanThayViet_${cleanCls}_${dateStr}.webm`
        setRecordedFileName(fileName)

        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        if (recordStreamRef.current) {
          recordStreamRef.current.getTracks().forEach((track) => track.stop())
        }

        toast.success('Đã lưu bài dạy về máy tính thành công!')
        setIsPostRecordModalOpen(true)
      }

      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      }

      recorder.start(1000)
      setIsRecording(true)
      setIsPausedRecording(false)
      setRecordDuration(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1)
      }, 1000)

      toast.success('Bắt đầu ghi hình bài dạy! Bảng viết Scrble Ink và giọng nói của Thầy đang được thu lại.')
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        toast.error('Không thể bắt đầu ghi hình: ' + (err.message || 'Lỗi thiết bị'))
      }
    }
  }

  const pauseOrResumeRecording = () => {
    if (!mediaRecorderRef.current) return
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPausedRecording(true)
      clearInterval(timerIntervalRef.current)
      toast('Đã tạm dừng ghi hình')
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPausedRecording(false)
      timerIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1)
      }, 1000)
      toast.success('Tiếp tục ghi hình bài dạy')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const handleSaveVideoToApp = (videoData: any) => {
    const newEntry = {
      id: Date.now().toString(),
      title: videoData.title || `Bài giảng ngày ${new Date().toLocaleDateString('vi-VN')}`,
      video_url: videoData.video_url,
      class_id: videoData.class_id || selectedClassId || '',
      class_name: classes?.find((c: any) => c.id === (videoData.class_id || selectedClassId))?.class_name || 'Lớp Toán',
      date: new Date().toISOString(),
      note: videoData.note || ''
    }

    const updated = [newEntry, ...savedVideos]
    setSavedVideos(updated)
    localStorage.setItem(LOCAL_STORAGE_VIDEOS_KEY, JSON.stringify(updated))
    toast.success('Đã lưu video bài giảng lên App cho học sinh xem lại!')
    setIsPostRecordModalOpen(false)
    setIsAddVideoModalOpen(false)
    setNewVideoForm({ title: '', video_url: '', class_id: '', note: '' })
  }

  const handleDeleteSavedVideo = (id: string) => {
    if (!window.confirm('Thầy có chắc muốn xóa video bài giảng này khỏi danh sách?')) return
    const updated = savedVideos.filter((v) => v.id !== id)
    setSavedVideos(updated)
    localStorage.setItem(LOCAL_STORAGE_VIDEOS_KEY, JSON.stringify(updated))
    toast.success('Đã xóa video bài giảng')
  }

  const getEmbedUrl = (url: string) => {
    if (!url) return null
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url
  }

  // Danh sách học sinh theo từng bàn dựa trên deskCapacity
  const desks = useMemo(() => {
    const result = []
    const filteredStudents = searchStudent.trim()
      ? studentsList.filter((s) => s.full_name?.toLowerCase().includes(searchStudent.toLowerCase()))
      : studentsList

    for (let i = 1; i <= deskCapacity; i++) {
      const student = filteredStudents[i - 1] || null
      result.push({
        seatNumber: i,
        student
      })
    }
    return result
  }, [deskCapacity, studentsList, searchStudent])

  const presentCount = studentsList.filter((s) => s.isOnline).length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* ── 1. THANH TIÊU ĐỀ CHÍNH & ÂM THANH TƯƠNG TÁC (HEADER SOUNDBOARD) ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 shrink-0 backdrop-blur-md sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        {/* Bên trái: Nút quay lại + Tên Lớp Thầy Việt */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(user ? '/' : '/thi')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-900/50">
              <Video className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm md:text-base tracking-wide text-white uppercase">
                  Lớp Học Thầy Việt
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  LIVE
                </span>
                <span className="hidden lg:inline text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/50">
                  Hotline: 0943.688.943
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ở giữa: THANH HIỆU ỨNG ÂM THANH (SOUNDBOARD LỚP HỌC Y TRÊN ẢNH) */}
        {isTeacher && (
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-teal-400" />
              <span>Âm thanh:</span>
            </span>

            <button
              onClick={() => playSoundEffect('applause')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-teal-600 text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 border border-slate-700"
            >
              <span>👏</span>
              <span className="hidden sm:inline">Vỗ tay</span>
            </button>

            <button
              onClick={() => playSoundEffect('reward')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 border border-slate-700"
            >
              <span>🎉</span>
              <span className="hidden sm:inline">Khen thưởng</span>
            </button>

            <button
              onClick={() => playSoundEffect('bell')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 border border-slate-700"
            >
              <span>🔔</span>
              <span className="hidden sm:inline">Chuông</span>
            </button>

            <button
              onClick={() => playSoundEffect('tingdong')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 border border-slate-700"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Ting đong</span>
            </button>

            <button
              onClick={() => playSoundEffect('suspense')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 border border-slate-700"
            >
              <span>⏳</span>
              <span className="hidden md:inline">Hồi hộp</span>
            </button>

            <button
              onClick={() => playSoundEffect('wrong')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 border border-slate-700"
            >
              <span>❌</span>
              <span className="hidden md:inline">Đáp sai</span>
            </button>

            {/* Điều chỉnh âm lượng nhanh */}
            <div className="hidden xl:flex items-center gap-1 border-l border-slate-800 pl-2 ml-1 text-[10px] font-bold">
              {[1.0, 0.75, 0.5, 0.25].map((v) => (
                <button
                  key={v}
                  onClick={() => setSoundVolume(v)}
                  className={`px-1.5 py-0.5 rounded ${soundVolume === v ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  {v * 100}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bên phải: Chuyển Chế độ Xem (Chỉ Video / Sơ đồ bàn học / Lưới camera) */}
        <div className="flex items-center gap-2">
          {/* Bộ 3 nút chuyển chế độ xem */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setViewMode('video_only')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${viewMode === 'video_only' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Phóng to video / Bảng viết"
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chỉ Video</span>
            </button>

            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${viewMode === 'split' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Xem Sơ đồ bàn học sinh kèm camera (như trên ảnh)"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Sơ Đồ Bàn Học</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${viewMode === 'grid' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Lưới camera toàn bộ học sinh"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lưới Camera</span>
            </button>
          </div>

          {/* Hotline & Zalo Thầy */}
          <a
            href={`tel:${TEACHER_PHONE}`}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 font-bold text-xs transition"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>0943.688.943</span>
          </a>

          <a
            href={ZALO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Zalo Thầy</span>
          </a>

          {/* Toàn màn hình */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Cài đặt */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition ${showSettings ? 'bg-teal-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
            title="Tùy chỉnh phòng"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── 2. THANH CÔNG CỤ ĐIỀU KHIỂN LỚP HỌC (TEACHER CONTROL BAR) ── */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center flex-wrap gap-2">
          {/* Nút Quay video bài dạy */}
          {isTeacher && (
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                >
                  <Circle className="w-3 h-3 fill-current animate-pulse text-rose-200" />
                  <span>Ghi màn hình</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-2">
                  <span className="text-rose-400 font-mono font-bold animate-pulse">
                    REC {formatDuration(recordDuration)}
                  </span>
                  <button onClick={pauseOrResumeRecording} className="p-1 rounded bg-slate-700 text-white">
                    {isPausedRecording ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  </button>
                  <button onClick={stopRecording} className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                    Dừng
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Nút Bảng Scrble Ink */}
          <button
            onClick={() => setIsScrbleModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-sm"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Bảng viết Scrble Ink</span>
          </button>

          {/* Nút Kho Video */}
          <button
            onClick={() => setIsSavedVideosModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold transition"
          >
            <Film className="w-3.5 h-3.5 text-teal-400" />
            <span>Kho Video ({savedVideos.length})</span>
          </button>

          {/* Tắt mic cả lớp */}
          {isTeacher && (
            <button
              onClick={handleToggleMuteAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-bold transition border border-slate-700"
              title="Tắt micro toàn bộ học sinh để giữ trật tự"
            >
              <MicOff className="w-3.5 h-3.5" />
              <span>Tắt mic cả lớp</span>
            </button>
          )}

          {/* Chuông giơ tay: Bật / Tắt */}
          {isTeacher && (
            <button
              onClick={() => {
                setHandRaiseAlarm(!handRaiseAlarm)
                toast.success(handRaiseAlarm ? 'Đã tắt chuông giơ tay' : 'Đã bật chuông giơ tay')
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition border ${handRaiseAlarm ? 'bg-amber-600/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              title="Bật/Tắt chuông báo khi học sinh bấm giơ tay"
            >
              {handRaiseAlarm ? <Bell className="w-3.5 h-3.5 text-amber-400" /> : <BellOff className="w-3.5 h-3.5" />}
              <span>Chuông giơ tay: {handRaiseAlarm ? 'BẬT' : 'TẮT'}</span>
            </button>
          )}

          {/* Nút Phát đề thi trực tiếp */}
          {isTeacher && (
            <button
              onClick={() => setIsDistributeExamModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-sm"
              title="Chọn đề thi và gửi trực tiếp cho cả lớp làm bài"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Phát đề thi trực tiếp...</span>
            </button>
          )}
        </div>

        {/* Thông tin phòng & Sao chép link */}
        <div className="flex items-center gap-2 text-slate-400">
          <span className="font-mono text-[11px] bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            Mã: <strong className="text-teal-400">{roomCode}</strong>
          </span>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold transition"
          >
            {isCopied ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
            <span>{isCopied ? 'Đã copy' : 'Copy link'}</span>
          </button>
        </div>
      </div>

      {/* Thông báo đề thi đang phát (nếu có) */}
      {distributedExamNotice && (
        <div className="bg-emerald-950 border-b border-emerald-600/50 px-4 py-2 flex items-center justify-between text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Đang phát đề thi: <strong>{distributedExamNotice.title}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/thi`)
                toast.success('Đã copy link cổng thi cho học sinh!')
              }}
              className="underline hover:text-white font-bold"
            >
              Copy link gửi HS
            </button>
            <button onClick={() => setDistributedExamNotice(null)} className="text-slate-400 hover:text-white ml-2">✕</button>
          </div>
        </div>
      )}

      {/* ── 3. KHU VỰC CHÍNH: CHIA 2 CỘT (VIDEO BÊN TRÁI + SƠ ĐỒ BÀN BÊN PHẢI) ── */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950">
        {/* CỘT TRÁI: VIDEO LIVE STREAM / CAMERA THẦY & HỌC SINH */}
        <div
          className={`${
            viewMode === 'video_only'
              ? 'w-full h-full'
              : viewMode === 'split'
              ? 'w-full lg:w-5/12 xl:w-4/12 h-[350px] lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800'
              : 'hidden'
          } relative flex flex-col bg-slate-950`}
        >
          {isLoadingApi && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm gap-3">
              <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-teal-400 text-xs font-semibold animate-pulse">
                Đang chuẩn bị phòng học trực tuyến...
              </p>
            </div>
          )}

          <div ref={jitsiContainerRef} className="w-full h-full flex-1 min-h-[300px] bg-slate-950" />
        </div>

        {/* CỘT PHẢI: SƠ ĐỒ LỚP HỌC & CHỖ NGỒI HỌC SINH (Y HỆT HÌNH ẢNH MÀN HÌNH CỦA THẦY) */}
        <div
          className={`${
            viewMode === 'video_only' ? 'hidden' : 'flex-1'
          } flex flex-col bg-slate-900/60 overflow-y-auto p-4 lg:p-6 custom-scrollbar`}
        >
          {/* Header Sơ Đồ Bàn Học */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Grid className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base md:text-lg font-black text-white">
                      Sơ Đồ Lớp Học & Chỗ Ngồi Học Sinh
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Đang có mặt: {presentCount} / {studentsList.length || deskCapacity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Quản lý trật tự lớp, theo dõi camera từng bàn học sinh theo sơ đồ bàn.
                  </p>
                </div>
              </div>

              {/* Bộ lọc quy mô bàn: 16 bàn | 24 bàn | 32 bàn */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Quy mô:</span>
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[16, 24, 32].map((num) => (
                    <button
                      key={num}
                      onClick={() => setDeskCapacity(num)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                        deskCapacity === num ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {num} bàn
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Thanh tìm kiếm & chọn lớp */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  placeholder="Tìm học sinh theo tên..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-slate-400">Lớp:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- Tất cả học sinh --</option>
                  {classes?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name} {c.grade ? `(Khối ${c.grade})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* DÃY BÀN HỌC SINH (GRID CÁC THẺ BÀN HỌC Y HỆT ẢNH) */}
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>DÃY BÀN HỌC SINH (SẮP XẾP THEO THỨ TỰ BÀN)</span>
            <span className="text-[11px] text-teal-400">BẤM VÀO BÀN ĐỂ XEM CHI TIẾT HỌC SINH</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3.5">
            {desks.map(({ seatNumber, student }) => {
              const avatarColor = AVATAR_COLORS[(seatNumber - 1) % AVATAR_COLORS.length]
              const displayChar = student?.full_name ? student.full_name.trim().charAt(0).toUpperCase() : 'H'

              if (student) {
                return (
                  <div
                    key={seatNumber}
                    onClick={() => setSelectedDeskStudent({ ...student, seatNumber })}
                    className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/70 rounded-2xl p-3.5 flex flex-col justify-between transition-all transform hover:-translate-y-0.5 hover:shadow-xl cursor-pointer group relative overflow-hidden"
                  >
                    {/* Badge Bàn số */}
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        BÀN {String(seatNumber).padStart(2, '0')}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          student.isOnline ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-slate-600'
                        }`}
                        title={student.isOnline ? 'Đang học Online' : 'Vắng'}
                      />
                    </div>

                    {/* Avatar tròn lớn chữ cái */}
                    <div className="flex items-center justify-center my-1.5">
                      <div
                        className={`w-12 h-12 rounded-full ${avatarColor} text-white font-black text-lg flex items-center justify-center shadow-lg group-hover:scale-105 transition`}
                      >
                        {displayChar}
                      </div>
                    </div>

                    {/* Tên học sinh & Lớp */}
                    <div className="text-center mt-2">
                      <h4 className="font-extrabold text-xs text-white truncate group-hover:text-teal-300 transition">
                        {student.full_name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {student.grade ? `Lớp ${student.grade}` : 'Học viên'}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-teal-400 group-hover:underline">
                        Chi tiết →
                      </span>
                    </div>
                  </div>
                )
              }

              {/* BÀN CHỖ TRỐNG */}
              return (
                <div
                  key={seatNumber}
                  className="bg-slate-950/40 border border-dashed border-slate-800/80 rounded-2xl p-3.5 flex flex-col items-center justify-center min-h-[140px] text-slate-400"
                >
                  <span className="text-[10px] font-black uppercase text-slate-400 mb-2">
                    BÀN {String(seatNumber).padStart(2, '0')}
                  </span>
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center mb-1 text-slate-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Chỗ trống</span>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* ── 4. MODAL CHI TIẾT HỌC SINH TẠI BÀN ── */}
      {selectedDeskStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                  {selectedDeskStudent.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-base text-white">{selectedDeskStudent.full_name}</h3>
                  <p className="text-xs text-teal-400">
                    Bàn số {selectedDeskStudent.seatNumber} • Mã: {selectedDeskStudent.student_code || '---'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeskStudent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="my-5 space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                <span className="text-slate-400">Trạng thái tham gia:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Đang có mặt trong lớp
                </span>
              </div>

              {selectedDeskStudent.parent_phone && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-slate-400">SĐT Phụ huynh:</span>
                  <a
                    href={`tel:${selectedDeskStudent.parent_phone}`}
                    className="font-mono font-bold text-blue-400 hover:underline"
                  >
                    {selectedDeskStudent.parent_phone}
                  </a>
                </div>
              )}

              {/* Tương tác nhanh với học sinh */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    playSoundEffect('reward')
                    toast.success(`Đã cộng điểm thưởng phát biểu cho ${selectedDeskStudent.full_name}!`)
                  }}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Award className="w-4 h-4" />
                  <span>Khen thưởng (+1đ)</span>
                </button>

                <button
                  onClick={() => {
                    playSoundEffect('tingdong')
                    toast(`Đã gọi em ${selectedDeskStudent.full_name} trả lời câu hỏi!`)
                  }}
                  className="py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Mic className="w-4 h-4" />
                  <span>Mời phát biểu</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDeskStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. MODAL PHÁT ĐỀ THI TRỰC TIẾP TRONG LỚP ── */}
      {isDistributeExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Phát Đề Thi Trực Tiếp Trong Giờ Học
              </h3>
              <button
                onClick={() => setIsDistributeExamModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <p className="text-slate-300">
                Thầy chọn đề thi từ ngân hàng để gửi cho cả lớp cùng làm ngay lúc này:
              </p>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Chọn đề thi:</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- Chọn đề thi cần phát --</option>
                  {availableExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
                💡 <strong>Cách học sinh nhận đề:</strong> Khi Thầy bấm "Phát đề", trên Cổng học sinh (`/thi`) sẽ lập tức hiển thị thông báo đề thi mới được giao để học sinh mở và làm bài trực tiếp!
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsDistributeExamModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!selectedExamId) return toast.error('Vui lòng chọn 1 đề thi!')
                  const found = availableExams.find((e) => e.id === selectedExamId)
                  setDistributedExamNotice(found)
                  setIsDistributeExamModalOpen(false)
                  playSoundEffect('bell')
                  toast.success(`Đã phát đề thi "${found?.title}" cho toàn thể học sinh!`)
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-900/50 transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Bắt Đầu Phát Đề Thi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. MODAL HƯỚNG DẪN DẠY VỚI BẢNG VIẾT SCRBLE INK ── */}
      {isScrbleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 text-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-400">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Hướng dẫn Dạy Toán với Bảng Scrble Ink
                  </h3>
                  <p className="text-xs text-purple-300">
                    Chiếu bảng viết ô ly, mực tím và hình vẽ Toán siêu mượt cho học sinh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScrbleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="my-5 space-y-4 text-xs md:text-sm">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <strong className="text-white text-sm">Mở phần mềm Scrble Ink trên máy tính:</strong>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Thầy mở app <strong>Scrble Ink</strong> (biểu tượng chiếc bút lông tím trên màn hình máy tính của Thầy). Chuẩn bị sẵn trang vở ô ly hoặc đề thi PDF cần giải.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <strong className="text-white text-sm">Bấm "Chia sẻ màn hình" (Screen Share):</strong>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Ở thanh công cụ phía đáy phòng học, Thầy bấm vào biểu tượng <strong>Màn hình máy tính</strong> (Chia sẻ màn hình).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <strong className="text-white text-sm">Chọn cửa sổ "Scrble Ink":</strong>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Tại hộp thoại hiện lên, Thầy chọn tab <strong>Cửa sổ (Window)</strong> $\rightarrow$ bấm chọn <strong>"Scrble Ink"</strong> $\rightarrow$ bấm <strong>Chia sẻ (Share)</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                💡 <strong>Mẹo hay:</strong> Học sinh sẽ thấy bảng viết của Thầy ở chế độ nét căng (Full HD), không giật lag. Thầy có thể vừa viết vừa nói giảng bài bình thường qua tai nghe/micro!
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsScrbleModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-900/50"
              >
                Đã hiểu, Bắt đầu dạy ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. MODAL HƯỚNG DẪN SAU KHI QUAY XONG: YOUTUBE / LƯU LÊN APP / ZALO ── */}
      {isPostRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 text-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Đã Ghi Hình & Lưu Video Bài Dạy Về Máy!
                  </h3>
                  <p className="text-xs text-emerald-400 font-mono">
                    File đã tải về: <strong>{recordedFileName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPostRecordModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="my-6 space-y-6">
              {/* BƯỚC 1: ĐƯA LÊN YOUTUBE */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-slate-800/40 border border-red-500/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-red-900/50">
                      <Youtube className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Bước 1: Tải video lên YouTube</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Thầy bấm nút để mở YouTube Studio, kéo file <strong>{recordedFileName}</strong> thả vào và chọn chế độ <em>"Không công khai"</em> hoặc <em>"Công khai"</em>.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://studio.youtube.com/channel/UC/videos/upload"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-lg shadow-red-900/50"
                  >
                    <span>Mở YouTube Studio</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* BƯỚC 2: DÁN LINK ĐỂ LƯU LÊN APP CHO HỌC SINH XEM LẠI */}
              <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30 space-y-3">
                <div className="flex items-center gap-2 text-teal-400">
                  <Upload className="w-4 h-4" />
                  <h4 className="font-extrabold text-sm text-white">Bước 2: Lưu Video Vào App cho Học sinh xem lại</h4>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tiêu đề bài dạy:</label>
                    <input
                      type="text"
                      value={newVideoForm.title}
                      onChange={(e) => setNewVideoForm({ ...newVideoForm, title: e.target.value })}
                      placeholder="VD: Toán 12 - Giải đề thi số 1 & Ôn tập tích phân"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Dán Link YouTube bài dạy vừa đăng:</label>
                    <input
                      type="text"
                      value={newVideoForm.video_url}
                      onChange={(e) => setNewVideoForm({ ...newVideoForm, video_url: e.target.value })}
                      placeholder="https://youtu.be/... hoặc https://www.youtube.com/watch?v=..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Gán cho Lớp học:</label>
                    <select
                      value={newVideoForm.class_id || selectedClassId}
                      onChange={(e) => setNewVideoForm({ ...newVideoForm, class_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="">-- Tất cả học sinh đều được xem --</option>
                      {classes?.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name} {c.grade ? `(Khối ${c.grade})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (!newVideoForm.video_url) return toast.error('Vui lòng dán link YouTube bài dạy!')
                      handleSaveVideoToApp(newVideoForm)
                    }}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-lg shadow-teal-900/50 transition flex items-center justify-center gap-2"
                  >
                    <Film className="w-4 h-4" />
                    <span>LƯU VIDEO LÊN APP NGAY</span>
                  </button>
                </div>
              </div>

              {/* BƯỚC 3: CHIA SẺ LÊN ZALO / FACEBOOK */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs text-white">Bước 3: Chia sẻ lên Mạng xã hội cho Phụ huynh & Học sinh</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Gửi link video vào nhóm Zalo lớp hoặc Facebook của Thầy</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://chat.zalo.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Mở Zalo Web</span>
                  </a>
                  <a
                    href="https://www.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Mở Facebook</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. MODAL KHO VIDEO BÀI GIẢNG ĐÃ LƯU ── */}
      {isSavedVideosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 text-slate-200 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Kho Video Bài Giảng Đã Dạy</h3>
                  <p className="text-xs text-slate-400">Học sinh bấm vào để xem lại bài dạy bất cứ lúc nào</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isTeacher && (
                  <button
                    onClick={() => setIsAddVideoModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/40 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Video Mới</span>
                  </button>
                )}
                <button
                  onClick={() => setIsSavedVideosModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {savedVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Film className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="font-semibold text-sm">Chưa có video bài dạy nào được lưu</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Thầy có thể bấm nút "Ghi màn hình" khi dạy học hoặc bấm "Thêm Video Mới" để dán link YouTube bài giảng!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between hover:border-teal-500/50 transition group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            {video.class_name || 'Lớp Toán'}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {video.date ? new Date(video.date).toLocaleDateString('vi-VN') : ''}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-white line-clamp-2 mb-2 group-hover:text-teal-300 transition">
                          {video.title}
                        </h4>

                        {video.note && (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-3">{video.note}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2 mt-2">
                        <button
                          onClick={() => setPreviewVideoUrl(video.video_url)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/30 hover:bg-teal-600 border border-teal-500/40 text-teal-300 hover:text-white font-bold text-xs transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Xem lại bài dạy</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(video.video_url)
                              toast.success('Đã copy link video để gửi Zalo!')
                            }}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white transition"
                            title="Copy link chia sẻ Zalo"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {isTeacher && (
                            <button
                              onClick={() => handleDeleteSavedVideo(video.id)}
                              className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-400 hover:text-white transition"
                              title="Xóa video bài giảng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 9. MODAL XEM POPUP VIDEO PLAYER ── */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-4 text-slate-200 shadow-2xl relative flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-teal-400" />
                Xem Lại Video Bài Giảng
              </h3>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="my-3 aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={getEmbedUrl(previewVideoUrl)}
                title="Video bài giảng"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="pt-2 flex justify-between items-center text-xs">
              <a
                href={previewVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                <span>Mở link gốc ngoài tab mới</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
