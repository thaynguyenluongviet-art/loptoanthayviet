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
  X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useDataStore } from '@/store/dataStore'
import toast from 'react-hot-toast'

const TEACHER_PHONE = '0943688943'
const TEACHER_NAME = 'Thầy Nguyễn Lương Việt'
const ZALO_LINK = `https://zalo.me/${TEACHER_PHONE}`
const LOCAL_STORAGE_VIDEOS_KEY = 'thayviet_recorded_lessons'

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
  const [showSettings, setShowSettings] = useState(false)
  const [isLoadingApi, setIsLoadingApi] = useState(false)

  // ── TÍNH NĂNG GHI HÌNH (MEDIA RECORDER) ──────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isPausedRecording, setIsPausedRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const recordStreamRef = useRef<MediaStream | null>(null)

  // Modal sau khi ghi hình xong & danh sách video đã lưu
  const [isPostRecordModalOpen, setIsPostRecordModalOpen] = useState(false)
  const [recordedVideoBlobUrl, setRecordedVideoBlobUrl] = useState<string | null>(null)
  const [recordedFileName, setRecordedFileName] = useState('')
  const [isSavedVideosModalOpen, setIsSavedVideosModalOpen] = useState(false)
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false)
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null)

  // Danh sách video bài giảng đã lưu
  const [savedVideos, setSavedVideos] = useState<any[]>([])
  const [newVideoForm, setNewVideoForm] = useState({
    title: '',
    video_url: '',
    class_id: '',
    note: ''
  })

  // Khởi tạo thông tin
  useEffect(() => {
    loadClasses()

    // Lấy danh sách video từ localStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_VIDEOS_KEY)
      if (stored) {
        setSavedVideos(JSON.parse(stored))
      }
    } catch (e) {
      console.error(e)
    }

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
          whiteboard: {
            enabled: true
          },
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
        console.warn('Không thể lấy micro, dùng âm thanh màn hình:', micErr)
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
        setRecordedVideoBlobUrl(blobUrl)

        const now = new Date()
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
        const currentClassName = classes?.find((c: any) => c.id === selectedClassId)?.class_name || 'LopToan'
        const cleanCls = currentClassName.replace(/[^a-zA-Z0-9]/g, '')
        const fileName = `BaiGiang_ToanThayViet_${cleanCls}_${dateStr}.webm`
        setRecordedFileName(fileName)

        // Tự động tải file video về máy tính của Thầy
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
      console.error('Lỗi khi bắt đầu quay video:', err)
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. TOP HEADER BAR */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 shrink-0 backdrop-blur-md sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-lg">
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

        <div className="flex items-center flex-wrap gap-2">
          {isTeacher && (
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-900/40 transition transform active:scale-95"
                  title="Ghi hình bài dạy (màn hình Scrble Ink + tiếng giảng)"
                >
                  <Circle className="w-3.5 h-3.5 fill-current animate-pulse text-rose-200" />
                  <span>Quay Video Bài Dạy</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-2">
                  <span className="inline-flex items-center gap-1.5 text-rose-400 font-mono font-bold text-xs animate-pulse">
                    <Circle className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                    REC {formatDuration(recordDuration)}
                  </span>
                  <button
                    onClick={pauseOrResumeRecording}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
                    title={isPausedRecording ? 'Tiếp tục ghi hình' : 'Tạm dừng ghi hình'}
                  >
                    {isPausedRecording ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
                    title="Dừng và lưu video về máy"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Dừng & Lưu</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setIsSavedVideosModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold text-xs transition shadow-sm"
            title="Xem lại các video bài dạy đã lưu"
          >
            <Film className="w-4 h-4 text-teal-400" />
            <span>Kho Video ({savedVideos.length})</span>
          </button>

          <button
            onClick={() => setIsScrbleModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-900/40 transition transform active:scale-95"
          >
            <PenTool className="w-4 h-4" />
            <span>Bảng viết Scrble Ink</span>
          </button>

          <a
            href={`tel:${TEACHER_PHONE}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 font-bold text-xs transition"
            title="Bấm để gọi Thầy Việt hỗ trợ"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hotline: 0943.688.943</span>
          </a>

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

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isCopied ? 'Đã copy' : 'Copy link'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Bật/Tắt Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition ${showSettings ? 'bg-teal-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
            title="Đổi phòng học / Tùy chỉnh"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. THANH CÀI ĐẶT / ĐỔI LỚP HỌC */}
      {showSettings && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 transition-all">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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

      {/* 5. MODAL HƯỚNG DẪN SAU KHI QUAY XONG: ĐĂNG YOUTUBE / LƯU LÊN APP / CHIA SẺ MẠNG XÃ HỘI */}
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
                <X className="w-5 h-5" />
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
                        Thầy bấm nút để mở YouTube Studio, kéo file <strong>{recordedFileName}</strong> thả vào và chọn chế độ <em>"Không công khai"</em> (chỉ học sinh của Thầy xem được) hoặc <em>"Công khai"</em>.
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

      {/* 6. MODAL KHO VIDEO BÀI GIẢNG ĐÃ LƯU (XEM LẠI & QUẢN LÝ) */}
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
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {savedVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Film className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="font-semibold text-sm">Chưa có video bài dạy nào được lưu</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Thầy có thể bấm nút "Quay Video Bài Dạy" khi dạy học hoặc bấm "Thêm Video Mới" để dán link YouTube bài giảng!
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

      {/* 7. MODAL THÊM VIDEO MỚI THỦ CÔNG */}
      {isAddVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-400" />
                Thêm Video Bài Giảng Lên App
              </h3>
              <button
                onClick={() => setIsAddVideoModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tiêu đề bài học:</label>
                <input
                  type="text"
                  value={newVideoForm.title}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, title: e.target.value })}
                  placeholder="VD: Toán 12 - Chuyên đề Mặt cầu & Hình nón"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Link Video YouTube / Drive:</label>
                <input
                  type="text"
                  value={newVideoForm.video_url}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Gán cho Lớp học:</label>
                <select
                  value={newVideoForm.class_id}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, class_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- Tất cả học sinh đều xem được --</option>
                  {classes?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name} {c.grade ? `(Khối ${c.grade})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ghi chú / Nhắc nhở bài tập (tuỳ chọn):</label>
                <textarea
                  value={newVideoForm.note}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, note: e.target.value })}
                  placeholder="Ghi chú bài tập về nhà, thời gian làm bài..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500 resize-none h-20"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsAddVideoModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!newVideoForm.video_url) return toast.error('Vui lòng nhập link video bài giảng!')
                  handleSaveVideoToApp(newVideoForm)
                }}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-lg shadow-teal-900/50 transition"
              >
                Lưu Video Bài Dạy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL XEM VIDEO BÀI GIẢNG (POPUP VIDEO PLAYER) */}
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
                <X className="w-5 h-5" />
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
