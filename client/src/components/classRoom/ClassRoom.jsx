import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonitorUp, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const JOIN_WAIT_MS = 18_000;

function waitSocketConnected(socket, ms = JOIN_WAIT_MS) {
  if (socket?.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket?.off('connect', onConnect);
      reject(new Error('socket_timeout'));
    }, ms);
    const onConnect = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      resolve();
    };
    socket.on('connect', onConnect);
  });
}

function emitJoin(socket, ticket, ms = JOIN_WAIT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join_timeout')), ms);
    socket.emit('class-room:join', { ticket }, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
  });
}

export function openClassRoom(scheduleId) {
  const id = String(scheduleId || '').trim();
  if (!id) return;
  window.dispatchEvent(new CustomEvent('cms-open-class-room', { detail: { scheduleId: id } }));
}

function StageVideo({ stream, muted = false, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  if (!stream) return null;
  return <video ref={ref} autoPlay muted={muted} playsInline className={className} />;
}

function Room({ scheduleId, onClose }) {
  const { socket, isConnected } = useSocket() || {};
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Đang kiểm tra tài khoản…');
  const [sharing, setSharing] = useState(false);
  const [localStreamState, setLocalStreamState] = useState(null);
  const [remotes, setRemotes] = useState({});
  const pcs = useRef(new Map());
  const localStream = useRef(null);
  const iceQueue = useRef(new Map());
  const scheduleRef = useRef(scheduleId);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  scheduleRef.current = scheduleId;

  const dropPeer = (socketId) => {
    const pc = pcs.current.get(socketId);
    pc?.close();
    pcs.current.delete(socketId);
    iceQueue.current.delete(socketId);
    setRemotes((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const makePc = (remoteId) => {
    const existing = pcs.current.get(remoteId);
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit('class-room:signal', {
        scheduleId: scheduleRef.current,
        to: remoteId,
        candidate: event.candidate,
      });
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      setRemotes((prev) => ({
        ...prev,
        [remoteId]: { stream, name: prev[remoteId]?.name || '' },
      }));
    };
    pcs.current.set(remoteId, pc);
    iceQueue.current.set(remoteId, []);
    return pc;
  };

  const ensureSenders = async (pc) => {
    const stream = localStream.current;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === track.kind);
      if (sender) {
        if (sender.track !== track) await sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    }
  };

  const ensureRecvOnly = (pc) => {
    if (localStream.current || pc.getTransceivers().length > 0) return;
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
  };

  const connectPeer = async (remoteId) => {
    const pc = makePc(remoteId);
    if (localStream.current) await ensureSenders(pc);
    else ensureRecvOnly(pc);
    if (pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit('class-room:signal', {
      scheduleId: scheduleRef.current,
      to: remoteId,
      description: pc.localDescription,
    });
  };

  useEffect(() => {
    if (!socket) {
      setError('Chưa kết nối được máy chủ. Hãy tải lại trang rồi vào lớp lại.');
      return undefined;
    }
    let alive = true;
    const onSignal = async (payload) => {
      if (payload.scheduleId !== scheduleRef.current || !payload.from) return;
      const pc = makePc(payload.from);
      try {
        if (payload.description?.type === 'offer') {
          if (pc.signalingState === 'have-local-offer') await pc.setLocalDescription({ type: 'rollback' });
          await pc.setRemoteDescription(payload.description);
          const queued = iceQueue.current.get(payload.from) || [];
          iceQueue.current.set(payload.from, []);
          for (const candidate of queued) {
            try { await pc.addIceCandidate(candidate); } catch { /* bỏ ứng viên cũ */ }
          }
          await ensureSenders(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('class-room:signal', {
            scheduleId: scheduleRef.current,
            to: payload.from,
            description: pc.localDescription,
          });
        } else if (payload.description?.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') await pc.setRemoteDescription(payload.description);
        } else if (payload.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
          else iceQueue.current.get(payload.from)?.push(payload.candidate);
        }
      } catch { /* tín hiệu đến lệch thứ tự thì lần chia sẻ sau nối lại */ }
    };
    const rememberPeer = (peer) => {
      if (!peer?.socketId) return;
      setRemotes((prev) => ({
        ...prev,
        [peer.socketId]: { ...(prev[peer.socketId] || {}), name: peer.name, stream: prev[peer.socketId]?.stream || null },
      }));
      connectPeer(peer.socketId).catch(() => {});
    };
    const onJoined = (payload) => {
      if (payload.scheduleId !== scheduleRef.current) return;
      rememberPeer(payload.peer);
    };
    const onLeft = (payload) => {
      if (payload.scheduleId !== scheduleRef.current) return;
      dropPeer(payload.socketId);
    };
    socket.on('class-room:signal', onSignal);
    socket.on('class-room:peer-joined', onJoined);
    socket.on('class-room:peer-left', onLeft);

    (async () => {
      try {
        if (!socket.connected) {
          setStatus('Đang kết nối máy chủ…');
          await waitSocketConnected(socket);
        }
        if (!alive) return;
        setStatus('Đang kiểm tra tài khoản…');
        const res = await apiFetch('/class-room/ticket', {
          method: 'POST',
          body: JSON.stringify({ scheduleId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !data.ticket) {
          setError(data.message || 'Tài khoản này không vào được buổi học.');
          setStatus('');
          return;
        }
        setStatus('Đang vào phòng…');
        const reply = await emitJoin(socket, data.ticket);
        if (!alive) return;
        if (!reply?.ok) {
          setError(reply?.message || 'Mã vào phòng không dùng được.');
          setStatus('');
          return;
        }
        setStatus('Đã vào phòng. Bấm chia sẻ màn hình khi muốn chiếu bài.');
        for (const peer of reply.peers || []) rememberPeer(peer);
      } catch (err) {
        if (!alive) return;
        if (err?.message === 'socket_timeout') {
          setError('Chưa kết nối được máy chủ. Hãy tải lại trang rồi bấm Vào lớp lại.');
        } else if (err?.message === 'join_timeout') {
          setError('Vào phòng quá lâu. Hãy tải lại trang rồi thử lại.');
        } else {
          setError('Không kết nối được phòng học.');
        }
        setStatus('');
      }
    })();

    return () => {
      alive = false;
      socket.emit('class-room:leave');
      socket.off('class-room:signal', onSignal);
      socket.off('class-room:peer-joined', onJoined);
      socket.off('class-room:peer-left', onLeft);
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      localStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    };
  }, [scheduleId, socket, isConnected]);

  const share = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      localStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current = stream;
      setLocalStreamState(stream);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setSharing(false);
        setStatus('Đã dừng chia sẻ màn hình.');
      });
      const ids = Object.keys(remotes);
      if (!ids.length) {
        setSharing(true);
        setStatus('Đang chia sẻ. Người trong phòng sẽ thấy khi họ vào lớp.');
        return;
      }
      const targets = [...new Set([...ids, ...pcs.current.keys()])];
      for (const remoteId of targets) {
        try { await connectPeer(remoteId); } catch { /* lần bấm lại sẽ chiếu tiếp */ }
      }
      setSharing(true);
      setStatus('Đang chia sẻ màn hình trong phòng này.');
    } catch (err) {
      if (err?.name === 'NotAllowedError') setStatus('Bạn đã đóng hộp chọn màn hình.');
      else setStatus('Trình duyệt không cho chia sẻ màn hình.');
    }
  };

  const remoteList = Object.entries(remotes).filter(([, item]) => item?.stream);
  const mainRemote = remoteList[0]?.[1] || null;
  return createPortal(
    <div className="fixed inset-0 z-[9600] flex h-[100dvh] w-screen flex-col bg-slate-950 text-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-black">Phòng học trực tiếp</p>
          <p className="text-xs text-slate-300">Chỉ tài khoản của buổi này vào được. Đưa link cho người khác cũng không vào được.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Rời phòng">
          <X size={18} />
        </button>
      </div>
      <div className="relative min-h-0 w-full flex-1 bg-black">
        {error ? <p className="absolute left-4 right-4 top-4 z-10 rounded-2xl bg-red-500/20 px-4 py-3 text-sm font-bold text-red-100">{error}</p> : null}
        {!error && status ? <p className="absolute left-4 top-4 z-10 max-w-lg rounded-full bg-black/50 px-3 py-1 text-xs text-slate-200">{status}</p> : null}
        {mainRemote ? (
          <StageVideo stream={mainRemote.stream} className="absolute inset-0 h-full w-full bg-black object-contain" />
        ) : (
          <StageVideo stream={localStreamState} muted className="absolute inset-0 h-full w-full bg-black object-contain" />
        )}
        {!mainRemote && !localStreamState && !error ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-400">Chưa có màn hình. Bấm Chia sẻ màn hình để chiếu bài.</p>
        ) : null}
        {mainRemote && localStreamState ? (
          <StageVideo stream={localStreamState} muted className="absolute bottom-4 right-4 z-10 h-28 w-48 rounded-xl bg-slate-900 object-contain ring-2 ring-white/30 sm:h-36 sm:w-64" />
        ) : null}
        {mainRemote?.name ? (
          <p className="absolute bottom-4 left-4 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white">{mainRemote.name}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-center border-t border-white/10 p-4">
        <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-black">
          <MonitorUp size={16} /> {sharing ? 'Chia sẻ lại màn hình' : 'Chia sẻ màn hình'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function ClassRoomHost() {
  const [scheduleId, setScheduleId] = useState('');
  useEffect(() => {
    const onOpen = (event) => setScheduleId(String(event.detail?.scheduleId || ''));
    window.addEventListener('cms-open-class-room', onOpen);
    return () => window.removeEventListener('cms-open-class-room', onOpen);
  }, []);
  if (!scheduleId) return null;
  return <Room key={scheduleId} scheduleId={scheduleId} onClose={() => setScheduleId('')} />;
}
