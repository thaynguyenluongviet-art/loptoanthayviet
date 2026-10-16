// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
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
  Layers
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useDataStore } from '@/store/dataStore'
import toast from 'react-hot-toast'

const TEACHER_PHONE = '0943688943'
const TEACHER_NAME = 'Thầy Nguyễn Lương Việt'
const ZALO_LINK = `https://zalo.me/${TEACHER_PHONE}`

export default function LiveClassroomPage({ isTeacherView = false }: { isTeacherView?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore() as any
  const { classes, loadClasses } = useDataStore() as any

  const jitsiContainerRef = useRef<HTMLDivElement>(null)
  const jitsiApiRef = useRef<any>(null)

  // Thông tin người tham gia
  const [userName, setUserName] = useState('')
  const [isTeacher, setIsTeacher] = useState(isTeacherView || !!user)
  const [selectedClassId, setSelectedClassId] = useState<string>(searchParams.get('classId') || '')
  const [roomCode, setRoomCode] = useState<string>(searchParams.get('room') || '')
  const [isJoined, setIsJoined] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isScrbleModalOpen, setIsScrbleModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [externalMeetUrl, setExternalMeetUrl] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [isLoadingApi, setIsLoadingApi] = useState(false)

  // Khởi tạo thông tin
  useEffect(() => {
    loadClasses()

    // Kiểm tra thông tin học sinh từ localStorage
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

  // Khởi chạy phòng học
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

      // Dọn dẹp container trước khi nhúng
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
          startWithAudioMuted: !isTeacher, // Học sinh vào thì tự động tắt mic để giữ yên lặng
          startWithVideoMuted: false,
          disableDeepLinking: true,        // Cho phép học trên trình duyệt điện thoại không cần cài app
          prejoinPageEnabled: false,       // Vào thẳng không cần màn hình chờ
          enableWelcomePage: false,
          enableClosePage: false,
          whiteboard: {
            enabled: true
          },
          toolbarButtons: [
            'microphone',
            'camera',
            'closedcaptions',
            'desktop',                     // Nút chia sẻ màn hình (Scrble Ink)
            'fullscreen',
            'fodeviceselection',
            'hangup',
            'profile',
            'chat',
            'raisehand',                   // Giơ tay phát biểu
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
          DEFAULT_BACKGROUND: '#0f172a'
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
        }
      })
    } catch (error: any) {
      console.error('Lỗi khởi tạo Jitsi Meet:', error)
      toast.error('Không thể kết nối phòng học: ' + (error.message || 'Vui lòng kiểm tra lại mạng'))
      setIsLoadingApi(false)
    }
  }

  // Tự động kết nối nếu có param trên URL
  useEffect(() => {
    if (roomCode && !isJoined && !isLoadingApi) {
      // Delay nhỏ để DOM container sẵn sàng
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

  // Sao chép liên kết phòng học
  const handleCopyLink = () => {
    const url = `${window.location.origin}/live?room=${encodeURIComponent(roomCode)}${selectedClassId ? `&classId=${selectedClassId}` : ''}`
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    toast.success('Đã sao chép link phòng học gửi cho học sinh!')
    setTimeout(() => setIsCopied(false), 2500)
  }

  // Chuyển đổi toàn màn hình
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. TOP HEADER BAR */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 shrink-0 backdrop-blur-md sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {/* Bên trái: Logo + Tên lớp */}
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
                <span className="font-extrabold text-sm md:text-base tracking-wide text-white uppercase">
                  Lớp Học Online – Lớp Toán Thầy Việt
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  TRỰC TIẾP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>Phòng: <strong className="text-teal-400">{roomCode || 'Chưa chọn'}</strong></span>
                <span>•</span>
                <span>Người tham gia: <strong className="text-white">{userName}</strong></span>
              </p>
            </div>
          </div>
        </div>

        {/* Ở giữa / Bên phải: Các nút chức năng tiện ích */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Nút hướng dẫn Bảng Scrble Ink */}
          <button
            onClick={() => setIsScrbleModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-900/40 transition transform active:scale-95"
          >
            <PenTool className="w-4 h-4" />
            <span>Bảng viết Scrble Ink</span>
          </button>

          {/* SĐT Thầy Việt Hotline */}
          <a
            href={`tel:${TEACHER_PHONE}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 font-bold text-xs transition"
            title="Bấm để gọi Thầy Việt hỗ trợ"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hotline: 0943.688.943</span>
          </a>

          {/* Zalo Thầy Việt */}
          <a
            href={ZALO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 font-bold text-xs transition"
            title="Nhắn Zalo Thầy Việt"
          >
            <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Zalo Thầy</span>
          </a>

          {/* Nút Copy Link phòng */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isCopied ? 'Đã copy' : 'Copy link'}</span>
          </button>

          {/* Toàn màn hình */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Bật/Tắt Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Cài đặt / Tùy chọn */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition ${showSettings ? 'bg-teal-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
            title="Đổi phòng học / Tùy chỉnh"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. THANH CÀI ĐẶT / ĐỔI LỚP HỌC (Dropdown mở rộng khi bấm nút Settings) */}
      {showSettings && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 transition-all">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Chọn lớp học */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Chọn lớp học đang dạy:</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Phòng chung (Tự do) --</option>
                {classes?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name} {c.grade ? `(Khối ${c.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Mã phòng tùy chỉnh */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Mã phòng họp (Jitsi Room):</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="VD: LopToanThayViet-12N1"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Nút vào lại / Kết nối */}
            <div className="flex items-end gap-2">
              <button
                onClick={startMeeting}
                disabled={isLoadingApi}
                className="flex-1 py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-teal-900/40"
              >
                <Radio className="w-4 h-4" />
                <span>{isLoadingApi ? 'Đang kết nối...' : 'Áp dụng & Kết nối lại'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. KHU VỰC CHÍNH: KHUNG PHÒNG HỌC VIDEO TRỰC TUYẾN */}
      <main className="flex-1 relative flex flex-col bg-slate-950 overflow-hidden">
        {/* Loading Spinner */}
        {isLoadingApi && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 border-4 border-teal-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-teal-400 text-sm font-semibold tracking-wide animate-pulse">
              Đang chuẩn bị phòng học trực tuyến cho Thầy & Trò...
            </p>
          </div>
        )}

        {/* Khung nhúng Jitsi Meet (Chiếm toàn bộ không gian) */}
        <div
          ref={jitsiContainerRef}
          className="w-full h-full flex-1 min-h-[500px] bg-slate-950"
        />
      </main>

      {/* 4. MODAL HƯỚNG DẪN DẠY VỚI BẢNG VIẾT SCRBLE INK */}
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
                    Ở thanh công cụ phía đáy phòng học bên dưới, Thầy bấm vào biểu tượng <strong>Màn hình máy tính</strong> (Chia sẻ màn hình).
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
    </div>
  )
}