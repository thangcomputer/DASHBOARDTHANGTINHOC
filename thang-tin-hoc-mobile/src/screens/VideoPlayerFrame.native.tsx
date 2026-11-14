import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { MobileLmsPlayerChrome } from '../components/dailyPractice/MobileLmsPlayerChrome';
import { typography } from '../theme/tokens';
import { getMobileApiBaseUrl } from '../services/apiClient';
import { noteStudyMediaProgress } from '../services/studyActivity';
import { createVideoWatchGuard } from './videoWatchGuard';
import { isDirectVideoUrl, vimeoIdFromUrl, youtubeIdFromUrl } from '../utils/videoSource';
import { readLmsMuted, readLmsVolume, writeLmsMuted, writeLmsVolume } from '../utils/lmsPlayerPrefs';
import { orderYouTubeQualities } from '../utils/youtubeQuality';
import type { VideoPlayerApi, VideoPlayerProgress } from './VideoPlayerFrame';
import { YT_BRANDED_PLAYER_VARS, YT_IFRAME_CROP } from '../../../shared/dailyPractice/lmsBrandedVideoPlayer.mjs';

type PlayerMessage =
  | ({ type: 'progress'; eligible?: boolean; playbackQuality?: string } & VideoPlayerProgress)
  | { type: 'qualities'; levels: string[]; current?: string }
  | { type: 'error'; message: string }
  | { type: 'anti_seek' };

function escapedScriptValue(value: string) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function createPlayerHtml({
  videoUrl,
  embeddedUrl,
  title,
  lessonId,
  antiSeekEnabled,
  done,
  origin,
  brandedChrome,
  initialVolume,
  initialMuted,
  chromeBg,
}: {
  videoUrl: string;
  embeddedUrl: string;
  title: string;
  lessonId: string;
  antiSeekEnabled: boolean;
  done: boolean;
  origin: string;
  brandedChrome: boolean;
  initialVolume: number;
  initialMuted: boolean;
  chromeBg: string;
}) {
  const isDirectVideo = isDirectVideoUrl(videoUrl);
  const youtubeId = youtubeIdFromUrl(videoUrl);
  const vimeoId = vimeoIdFromUrl(videoUrl);
  const guardFactory = createVideoWatchGuard.toString();
  const encoded = {
    videoUrl: escapedScriptValue(videoUrl),
    embeddedUrl: escapedScriptValue(embeddedUrl),
    title: escapedScriptValue(title),
    lessonId: escapedScriptValue(lessonId),
    origin: escapedScriptValue(origin),
    antiSeekEnabled: JSON.stringify(antiSeekEnabled),
    done: JSON.stringify(done),
    brandedChrome: JSON.stringify(brandedChrome),
    isDirectVideo: JSON.stringify(isDirectVideo),
    youtubeId: escapedScriptValue(youtubeId),
    vimeoId: escapedScriptValue(vimeoId),
    initialVolume: JSON.stringify(Math.max(0, Math.min(100, Math.round(initialVolume)))),
    initialMuted: JSON.stringify(Boolean(initialMuted)),
    ytCropScale: JSON.stringify(YT_IFRAME_CROP.scale),
    ytCropSize: JSON.stringify(YT_IFRAME_CROP.sizePercent),
    ytTranslateY: JSON.stringify(YT_IFRAME_CROP.translateYPercent),
    ytVeilPx: JSON.stringify(YT_IFRAME_CROP.topVeilPx),
    ytBottomVeilH: JSON.stringify(YT_IFRAME_CROP.bottomVeilHeightPx),
    ytBottomVeilW: JSON.stringify(YT_IFRAME_CROP.bottomVeilWidthPx),
    ytPlayerBg: escapedScriptValue(chromeBg),
    ytBrandedVars: JSON.stringify(YT_BRANDED_PLAYER_VARS),
  };
  const topVeilBg = `linear-gradient(180deg,${chromeBg} 0%,${chromeBg} 80%,rgba(0,0,0,0) 100%)`;
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="origin">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${chromeBg}}
#player{position:relative;margin:0;width:100%;height:100%;overflow:hidden;background:${chromeBg}}
#player video{width:100%!important;height:100%!important;border:0!important;object-fit:contain}
#player iframe{border:0!important}
#yt-top-veil{position:absolute;top:0;left:0;right:0;height:${YT_IFRAME_CROP.topVeilPx}px;z-index:6;pointer-events:none;background:${topVeilBg}}
#yt-bottom-veil{position:absolute;bottom:0;right:0;width:${YT_IFRAME_CROP.bottomVeilWidthPx}px;height:${YT_IFRAME_CROP.bottomVeilHeightPx}px;z-index:6;pointer-events:none;background:${chromeBg}}
#yt-edge-top{position:absolute;top:0;left:0;right:0;height:8px;z-index:7;pointer-events:none;background:${chromeBg}}
</style>
</head><body><div id="player"><div id="yt-edge-top" style="display:none"></div><div id="yt-top-veil" style="display:none"></div><div id="yt-bottom-veil" style="display:none"></div></div><script>
(function(){
  const videoUrl=${encoded.videoUrl};
  const embeddedUrl=${encoded.embeddedUrl};
  const title=${encoded.title};
  const lessonId=${encoded.lessonId};
  const origin=${encoded.origin};
  let antiSeekEnabled=${encoded.antiSeekEnabled};
  let completed=${encoded.done};
  const brandedChrome=${encoded.brandedChrome};
  const isDirectVideo=${encoded.isDirectVideo};
  const youtubeId=${encoded.youtubeId};
  const vimeoId=${encoded.vimeoId};
  const createVideoWatchGuard=${guardFactory};
  const watchKey='student_lms_pos_'+lessonId;
  const watchedKey='student_lms_watched_'+lessonId;
  function readStoredNumber(key){
    try{const value=Number(localStorage.getItem(key)||0);return Number.isFinite(value)&&value>0?value:0;}
    catch(error){console.error('Không thể đọc tiến độ video đã lưu.',error);return 0;}
  }
  const initialMaxPosition=completed?0:readStoredNumber(watchKey);
  const initialWatchedSeconds=completed?0:readStoredNumber(watchedKey);
  const guard=createVideoWatchGuard(youtubeId?1.25:2,initialWatchedSeconds,initialMaxPosition);
  let pending=false;
  let retryAt=0;
  let thresholdReached=false;
  let playing=false;
  let lastSent=0;
  let lastSaved=0;
  let player=null;
  let video=null;
  let frame=null;
  const initialVolume=${encoded.initialVolume};
  const initialMuted=${encoded.initialMuted};
  let preferredMaxOnce=false;
  function send(value){window.ReactNativeWebView.postMessage(JSON.stringify(value));}
  function readPlaybackQuality(){
    if(!player) return 'default';
    try{const q=player.getPlaybackQuality();if(q&&q!=='unknown')return String(q);}catch(_){}
    return 'default';
  }
  function disableCaptions(){
    if(!player)return;
    try{player.unloadModule&&player.unloadModule('captions');}catch(_){}
    try{player.unloadModule&&player.unloadModule('cc');}catch(_){}
    try{player.setOption&&player.setOption('captions','track',{});}catch(_){}
    try{player.setOption&&player.setOption('cc','track',{});}catch(_){}
  }
  function preferMaxQuality(){
    if(!player||preferredMaxOnce) return;
    preferredMaxOnce=true;
    try{
      const levels=player.getAvailableQualityLevels?player.getAvailableQualityLevels():[];
      const order=['highres','hd2160','hd1440','hd1080','hd720','large','medium','small','tiny'];
      const best=order.find(function(q){return levels.indexOf(q)>=0;});
      if(best){try{player.setPlaybackQualityRange&&player.setPlaybackQualityRange(best,best);}catch(_){}player.setPlaybackQuality(best);}
    }catch(_){}
  }
  function applyVolume(vol,muted){
    const n=Math.max(0,Math.min(100,Math.round(Number(vol)||0)));
    const isMuted=!!muted||n===0;
    if(video){video.volume=n/100;video.muted=isMuted;}
    else if(player){try{player.setVolume(n);if(isMuted)player.mute();else player.unMute();}catch(_){}}
  }
  const ytCropScale=${encoded.ytCropScale};
  const ytCropSize=${encoded.ytCropSize};
  const ytTranslateY=${encoded.ytTranslateY};
  const ytBrandedVars=${encoded.ytBrandedVars};
  var ytIframe=null;
  function ytPlayerVars(){
    var base=Object.assign({},ytBrandedVars,{
      origin:origin,
      start:Math.floor(initialMaxPosition),
      autoplay:brandedChrome?0:1
    });
    if(!brandedChrome){
      return Object.assign({},base,{controls:1,disablekb:0,fs:1});
    }
    return base;
  }
  /** Crop + chặn tương tác — mobile WebView (shared/lmsBrandedVideoPlayer). */
  function applyYouTubeBrandedChrome(iframe){
    if(!iframe||!brandedChrome)return;
    ytIframe=iframe;
    iframe.style.position='absolute';
    iframe.style.top='50%';
    iframe.style.left='50%';
    iframe.style.width=ytCropSize+'%';
    iframe.style.height=ytCropSize+'%';
    iframe.style.transform='translate(-50%,'+ytTranslateY+'%) scale('+ytCropScale+')';
    iframe.style.transformOrigin='center center';
    iframe.style.pointerEvents='none';
    iframe.style.border='0';
    ['yt-edge-top','yt-top-veil','yt-bottom-veil'].forEach(function(id){
      var el=document.getElementById(id);
      if(el)el.style.display='block';
    });
  }
  window.__applyYouTubeBrandedChrome=applyYouTubeBrandedChrome;
  window.__setPlayerChromeBg=function(bg){
    var color=String(bg||'');
    document.documentElement.style.backgroundColor=color;
    document.body.style.backgroundColor=color;
    var p=document.getElementById('player');if(p)p.style.backgroundColor=color;
    var top=document.getElementById('yt-top-veil');
    if(top)top.style.background='linear-gradient(180deg,'+color+' 0%,'+color+' 80%,rgba(0,0,0,0) 100%)';
    ['yt-bottom-veil','yt-edge-top'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.backgroundColor=color;});
    if(ytIframe)applyYouTubeBrandedChrome(ytIframe);
  };
  window.addEventListener('resize',function(){
    if(ytIframe)applyYouTubeBrandedChrome(ytIframe);
  });
  window.addEventListener('orientationchange',function(){
    setTimeout(function(){if(ytIframe)applyYouTubeBrandedChrome(ytIframe);},120);
  });
  let antiSeekHudTimer=null;
  function showAntiSeekHud(){
    var el=document.getElementById('anti-seek-hud');
    if(!el){
      el=document.createElement('div');
      el.id='anti-seek-hud';
      el.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;z-index:2147483646';
      el.innerHTML='<div style="display:flex;align-items:center;background:rgba(0,0,0,0.88);padding:10px 16px;border-radius:20px;border:1.5px solid #10B981;color:#fff;font-weight:900;font-size:13px;font-family:system-ui,sans-serif;letter-spacing:0.04em"><span style="display:inline-flex;width:22px;height:22px;margin-right:8px;border-radius:11px;background:#059669;align-items:center;justify-content:center;font-size:11px">!</span><span>Chống tua video</span></div>';
      document.body.appendChild(el);
    }
    el.style.display='flex';
    clearTimeout(antiSeekHudTimer);
    antiSeekHudTimer=setTimeout(function(){el.style.display='none';},2000);
  }
  window.__mobileShowAntiSeekHud=showAntiSeekHud;
  function report(time,duration,isPlaying,seek){
    const tick=guard.tick(time,duration,isPlaying,antiSeekEnabled,completed||thresholdReached);
    if(tick.seekTo!==null){
      seek(tick.seekTo);
      showAntiSeekHud();
      send({type:'anti_seek'});
      return;
    }
    const now=Date.now();
    if(!completed&&now-lastSaved>=1000){
      lastSaved=now;
      try{localStorage.setItem(watchKey,String(tick.maxPosition));localStorage.setItem(watchedKey,String(tick.watchedSeconds));}
      catch(error){console.error('Không thể lưu tiến độ video đã xem.',error);}
    }
    const progress={type:'progress',currentTime:time,duration:duration,watchedSeconds:tick.watchedSeconds,completed:completed,playing:isPlaying,playbackQuality:readPlaybackQuality()};
    if(now-lastSent>=500){lastSent=now;send(progress);}
    if(tick.eligible&&!completed&&!pending&&now>=retryAt){
      thresholdReached=true;
      pending=true;
      send({type:'progress',currentTime:time,duration:duration,watchedSeconds:tick.watchedSeconds,completed:false,playing:isPlaying,eligible:true});
      retryAt=now+5000;
      setTimeout(function(){pending=false;},5000);
    }
  }
  function poll(){
    if(isDirectVideo&&video){
      report(video.currentTime,video.duration,!video.paused&&!video.ended,function(position){video.currentTime=position;});
    }else if(youtubeId&&player){
      report(player.getCurrentTime()||0,player.getDuration()||0,player.getPlayerState()===1,function(position){player.seekTo(position,true);});
    }
  }
  if(isDirectVideo){
    video=document.createElement('video');video.src=videoUrl;video.controls=!brandedChrome;video.autoplay=true;video.playsInline=true;video.setAttribute('controlsList','nodownload noplaybackrate');video.setAttribute('aria-label',title);document.getElementById('player').appendChild(video);
    video.addEventListener('loadedmetadata',function(){applyVolume(initialVolume,initialMuted);if(!completed&&initialMaxPosition>0)video.currentTime=Math.min(initialMaxPosition,Math.max(0,video.duration-1));});
    video.addEventListener('play',function(){playing=true;});
    video.addEventListener('pause',function(){playing=false;});
    video.addEventListener('seeking',poll);
    video.addEventListener('seeked',poll);
  }else if(youtubeId){
    function initializePlayer(){
      const target=document.getElementById('player');
      if(!target||!window.YT||!window.YT.Player)return;
      var existing=target.querySelector('#yt-embed-host');
      if(!existing){
        existing=document.createElement('div');
        existing.id='yt-embed-host';
        existing.style.cssText='position:absolute;inset:0;overflow:hidden';
        var veil=target.querySelector('#yt-top-veil');
        if(veil) target.insertBefore(existing,veil);
        else target.appendChild(existing);
      }
      player=new window.YT.Player(existing,{videoId:youtubeId,playerVars:ytPlayerVars(),events:{
        onReady:function(event){
          const iframe=event.target.getIframe();
          iframe.referrerPolicy='origin';
          if(brandedChrome){
            applyYouTubeBrandedChrome(iframe);
          }else{
            iframe.style.width='100%';
            iframe.style.height='100%';
            iframe.style.border='0';
          }
          applyVolume(initialVolume,initialMuted);
          if(!completed&&initialMaxPosition>0)event.target.seekTo(initialMaxPosition,true);
          preferMaxQuality();
          disableCaptions();
          poll();
        },
        onApiChange:function(){
          disableCaptions();
        },
        onStateChange:function(event){
          playing=event.data===window.YT.PlayerState.PLAYING;
          if(playing){
            preferMaxQuality();
            disableCaptions();
          }
          if(event.data===window.YT.PlayerState.ENDED&&!completed&&!pending){
            thresholdReached=true;
            pending=true;
            send({type:'progress',currentTime:player.getDuration()||0,duration:player.getDuration()||0,watchedSeconds:player.getDuration()||0,completed:false,playing:false,eligible:true});
            retryAt=Date.now()+5000;
            setTimeout(function(){pending=false;},5000);
          }
        },
        onError:function(event){send({type:'error',message:Number(event&&event.data)===153?'YouTube không nhận được địa chỉ tham chiếu để phát video. Hãy cập nhật ứng dụng hoặc mở video trên YouTube.':'Không thể phát video YouTube này.'});}
      }});
    }
    window.onYouTubeIframeAPIReady=initializePlayer;
    if(window.YT&&window.YT.Player){
      initializePlayer();
    }else{
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=function(){send({type:'error',message:'Không tải được trình phát YouTube.'});};document.head.appendChild(script);
    }
  }else if(vimeoId){
    frame=document.createElement('iframe');frame.src=embeddedUrl+(embeddedUrl.indexOf('?')>=0?'&':'?')+'api=1&player_id=mobile-course-video';frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.title=title;document.getElementById('player').appendChild(frame);
    function subscribe(){['playProgress','play','pause'].forEach(function(event){frame.contentWindow.postMessage(JSON.stringify({method:'addEventListener',value:event}),'https://player.vimeo.com');});}
    window.addEventListener('message',function(event){
      if(event.origin!=='https://player.vimeo.com'||event.source!==frame.contentWindow)return;
      let payload=event.data;if(typeof payload==='string'){try{payload=JSON.parse(payload);}catch(_){return;}}
      if(!payload||typeof payload!=='object')return;
      if(payload.event==='ready'){
        subscribe();
        if(!completed&&initialMaxPosition>0)frame.contentWindow.postMessage(JSON.stringify({method:'setCurrentTime',value:initialMaxPosition}),'https://player.vimeo.com');
      }
      if(payload.event==='play')playing=true;
      if(payload.event==='pause')playing=false;
      if(payload.event==='playProgress'&&payload.data){
        const time=Number(payload.data.seconds)||0;const duration=Number(payload.data.duration)||0;
        report(time,duration,playing,function(position){frame.contentWindow.postMessage(JSON.stringify({method:'setCurrentTime',value:position}),'https://player.vimeo.com');});
      }
    });
    frame.addEventListener('load',subscribe);
  }else{
    send({type:'error',message:'Không nhận diện được liên kết video.'});
  }
  window.__mobileVideoState={getCurrentTime:function(){return video?video.currentTime:(player?player.getCurrentTime()||0:0);},getDuration:function(){return video?video.duration:(player?player.getDuration()||0:0);}};
  window.__mobileVideoCommands={
    play:function(){if(video){void video.play();}else if(player&&player.playVideo){player.playVideo();}else if(frame&&frame.contentWindow){frame.contentWindow.postMessage(JSON.stringify({method:'play'}),'https://player.vimeo.com');}},
    pause:function(){if(video){video.pause();}else if(player&&player.pauseVideo){player.pauseVideo();}else if(frame&&frame.contentWindow){frame.contentWindow.postMessage(JSON.stringify({method:'pause'}),'https://player.vimeo.com');}},
    seekTo:function(t){const sec=Math.max(0,Number(t)||0);if(video){video.currentTime=sec;}else if(player){player.seekTo(sec,true);}else if(frame&&frame.contentWindow){frame.contentWindow.postMessage(JSON.stringify({method:'setCurrentTime',value:sec}),'https://player.vimeo.com');}},
    setVolume:function(v,m){applyVolume(v,m);},
    setQuality:function(level){
      if(!player) return;
      try{
        const q=String(level||'default');
        if(q==='default') player.setPlaybackQuality('default');
        else{try{player.setPlaybackQualityRange&&player.setPlaybackQualityRange(q,q);}catch(_){}player.setPlaybackQuality(q);}
      }catch(_){}
    },
    publishQualities:function(){
      try{
        const levels=player&&player.getAvailableQualityLevels?player.getAvailableQualityLevels():[];
        send({type:'qualities',levels:levels,current:readPlaybackQuality()});
      }catch(_){}
    }
  };
  setInterval(poll,500);
})();
</script></body></html>`;
}

export function VideoPlayerFrame({
  videoUrl,
  embeddedUrl,
  title,
  lessonId,
  antiSeekEnabled,
  done,
  onProgress,
  onWatched,
  playerApiRef,
  brandedChrome = true,
  appearance = 'default',
  chromeBg,
  chromeRightSlot = null,
}: {
  videoUrl: string;
  embeddedUrl: string;
  title: string;
  lessonId: string;
  antiSeekEnabled: boolean;
  done: boolean;
  onProgress: (progress: VideoPlayerProgress) => void;
  onWatched: () => Promise<boolean>;
  playerApiRef?: { current: VideoPlayerApi | null };
  brandedChrome?: boolean;
  /** Giống web StudentVideoPlayer appearance="window" (popup lộ trình). */
  appearance?: 'default' | 'window';
  /** Nền vùng video (popup #23262E) — veil khớp màu, không lộ viền YT. */
  chromeBg?: string;
  chromeRightSlot?: React.ReactNode;
}) {
  const surfaceBg = chromeBg || YT_IFRAME_CROP.playerBg;
  const webViewRef = useRef<WebView>(null);
  const [playerError, setPlayerError] = useState('');
  const [showAntiSeekNotice, setShowAntiSeekNotice] = useState(false);
  const [uiProgress, setUiProgress] = useState<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: 0,
    completed: done,
    playing: false,
  });
  const antiSeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [liveQuality, setLiveQuality] = useState<string | null>(null);
  const [qualityOptions, setQualityOptions] = useState<string[]>(['default']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [awaitingStart, setAwaitingStart] = useState(true);
  const isYouTube = Boolean(youtubeIdFromUrl(videoUrl));

  useEffect(() => {
    setAwaitingStart(true);
    setIsFullscreen(false);
  }, [lessonId, videoUrl]);

  const progressRef = useRef<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: 0,
    completed: done,
    playing: false,
  });
  const onProgressRef = useRef(onProgress);
  const onWatchedRef = useRef(onWatched);
  const doneRef = useRef(done);
  const injectPlayerCommand = useCallback((statement: string) => {
    webViewRef.current?.injectJavaScript(
      `(function(){try{${statement}}catch(e){console.error(e);}})();true;`,
    );
  }, []);

  const triggerAntiSeekNotice = useCallback((alsoInjectHud = true) => {
    setShowAntiSeekNotice(true);
    if (alsoInjectHud) {
      injectPlayerCommand('window.__mobileShowAntiSeekHud&&window.__mobileShowAntiSeekHud();');
    }
    if (antiSeekTimerRef.current) clearTimeout(antiSeekTimerRef.current);
    antiSeekTimerRef.current = setTimeout(() => setShowAntiSeekNotice(false), 2200);
  }, [injectPlayerCommand]);

  useEffect(() => {
    return () => {
      if (antiSeekTimerRef.current) clearTimeout(antiSeekTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.all([readLmsVolume(50), readLmsMuted(false)]).then(([vol, isMuted]) => {
      if (!alive) return;
      setVolume(vol);
      setMuted(isMuted);
      setPrefsReady(true);
    });
    return () => { alive = false; };
  }, []);

  const source = useMemo(() => {
    const apiOrigin = new URL(getMobileApiBaseUrl()).origin;
    return {
      html: createPlayerHtml({
        videoUrl,
        embeddedUrl,
        title,
        lessonId,
        antiSeekEnabled,
        done,
        origin: apiOrigin,
        brandedChrome,
        initialVolume: volume,
        initialMuted: muted,
        chromeBg: surfaceBg,
      }),
      baseUrl: apiOrigin,
    };
  }, [videoUrl, embeddedUrl, title, lessonId, antiSeekEnabled, done, brandedChrome, prefsReady, surfaceBg]);
  onProgressRef.current = onProgress;
  onWatchedRef.current = onWatched;
  doneRef.current = done;

  useEffect(() => {
    const api: VideoPlayerApi = {
      getCurrentTime: () => progressRef.current.currentTime,
      getDuration: () => progressRef.current.duration,
      play: () => injectPlayerCommand('window.__mobileVideoCommands&&window.__mobileVideoCommands.play();'),
      pause: () => injectPlayerCommand('window.__mobileVideoCommands&&window.__mobileVideoCommands.pause();'),
      seekTo: (sec: number) => injectPlayerCommand(`window.__mobileVideoCommands&&window.__mobileVideoCommands.seekTo(${sec});`),
    };
    if (playerApiRef) playerApiRef.current = api;
    return () => {
      if (playerApiRef?.current === api) playerApiRef.current = null;
    };
  }, [injectPlayerCommand, playerApiRef]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let message: PlayerMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as PlayerMessage;
    } catch (error) {
      console.error('Không đọc được dữ liệu tiến độ từ trình phát video.', error);
      setPlayerError('Không đọc được tiến độ video. Vui lòng tải lại trình phát.');
      return;
    }
    if (message.type === 'error') {
      setPlayerError(message.message);
      return;
    }
    if (message.type === 'anti_seek') {
      triggerAntiSeekNotice(false);
      return;
    }
    if (message.type === 'qualities') {
      const levels = Array.isArray(message.levels) ? message.levels.map(String) : [];
      setQualityOptions(orderYouTubeQualities(levels));
      if (message.current) setLiveQuality(String(message.current));
      return;
    }
    if (message.type !== 'progress') return;
    const progress: VideoPlayerProgress = {
      currentTime: Number(message.currentTime) || 0,
      duration: Number(message.duration) || 0,
      watchedSeconds: Number(message.watchedSeconds) || 0,
      completed: Boolean(message.completed),
      playing: Boolean(message.playing),
    };
    progressRef.current = progress;
    setUiProgress(progress);
    if (progress.playing) setAwaitingStart(false);
    if (message.playbackQuality) {
      const q = String(message.playbackQuality);
      if (q && q !== 'unknown') setLiveQuality(q);
    }
    noteStudyMediaProgress(progress.playing);
    onProgressRef.current(progress);
    if (message.eligible && !doneRef.current) {
      void onWatchedRef.current().then((saved) => {
        if (saved) {
          doneRef.current = true;
          progressRef.current = { ...progressRef.current, completed: true };
          onProgressRef.current(progressRef.current);
        }
      }).catch((error: unknown) => {
        console.error('Không thể lưu tiến độ video đã xem.', error);
      });
    }
  };

  const togglePlay = () => {
    if (uiProgress.playing) {
      injectPlayerCommand('window.__mobileVideoCommands&&window.__mobileVideoCommands.pause();');
    } else {
      setAwaitingStart(false);
      injectPlayerCommand('window.__mobileVideoCommands&&window.__mobileVideoCommands.play();');
    }
  };

  const seekTo = (position: number) => {
    injectPlayerCommand(`window.__mobileVideoCommands&&window.__mobileVideoCommands.seekTo(${position});`);
    setUiProgress((prev) => ({ ...prev, currentTime: position }));
  };

  const seekLocked = antiSeekEnabled && !done;

  const applyVolume = useCallback((nextVol: number, nextMuted = muted) => {
    const vol = Math.max(0, Math.min(100, Math.round(nextVol)));
    setVolume(vol);
    setMuted(nextMuted);
    void writeLmsVolume(vol);
    void writeLmsMuted(nextMuted);
    injectPlayerCommand(`window.__mobileVideoCommands&&window.__mobileVideoCommands.setVolume(${vol},${nextMuted ? 'true' : 'false'});`);
  }, [injectPlayerCommand, muted]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    void writeLmsMuted(nextMuted);
    injectPlayerCommand(`window.__mobileVideoCommands&&window.__mobileVideoCommands.setVolume(${volume},${nextMuted ? 'true' : 'false'});`);
  }, [injectPlayerCommand, muted, volume]);

  const selectQuality = useCallback((level: string) => {
    const q = JSON.stringify(level);
    injectPlayerCommand(`window.__mobileVideoCommands&&window.__mobileVideoCommands.setQuality(${q});`);
    setLiveQuality(level);
  }, [injectPlayerCommand]);

  const playerSurfaceBg = isFullscreen ? '#000000' : surfaceBg;
  const maskBg = playerSurfaceBg;

  useEffect(() => {
    if (!brandedChrome || !isYouTube || !prefsReady) return;
    const bg = JSON.stringify(playerSurfaceBg);
    injectPlayerCommand(`window.__setPlayerChromeBg&&window.__setPlayerChromeBg(${bg});`);
  }, [playerSurfaceBg, brandedChrome, isYouTube, prefsReady, injectPlayerCommand]);
  const youtubeMasks = brandedChrome && isYouTube && !playerError && prefsReady ? (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: YT_IFRAME_CROP.nativeTopMaskPx,
          zIndex: 44,
          backgroundColor: maskBg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 88,
          right: 0,
          width: YT_IFRAME_CROP.nativeBottomMaskWidthPx,
          height: YT_IFRAME_CROP.nativeBottomMaskPx,
          zIndex: 44,
          backgroundColor: maskBg,
        }}
      />
    </>
  ) : null;

  const playerBody = (
    <View style={{ flex: 1, position: 'relative', backgroundColor: playerSurfaceBg }}>
      {prefsReady ? (
        <WebView
          ref={webViewRef}
          source={source}
          style={{ flex: 1, backgroundColor: playerSurfaceBg }}
          pointerEvents={brandedChrome ? 'none' : 'auto'}
          onMessage={handleMessage}
          onLoadEnd={() => {
            injectPlayerCommand(`window.__mobileVideoCommands&&window.__mobileVideoCommands.setVolume(${volume},${muted ? 'true' : 'false'});`);
          }}
          onError={(event) => {
            const description = event.nativeEvent.description || 'Không thể tải trình phát video.';
            setPlayerError(description);
          }}
          accessibilityLabel={title}
          allowsInlineMediaPlayback
          allowsFullscreenVideo={!brandedChrome}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          startInLoadingState
        />
      ) : null}
      {youtubeMasks}
      {brandedChrome && !playerError && prefsReady ? (
        <MobileLmsPlayerChrome
          overlayVariant={appearance === 'window' ? 'window' : 'default'}
          startOverlayVisible={appearance === 'window' && awaitingStart && !uiProgress.playing}
          isPlaying={uiProgress.playing}
          currentTime={uiProgress.currentTime}
          duration={uiProgress.duration}
          onPlay={togglePlay}
          onPause={togglePlay}
          onSeek={seekLocked ? undefined : seekTo}
          lockSeek={seekLocked}
          onBlockedSeek={() => triggerAntiSeekNotice(true)}
          showAntiSeekNotice={showAntiSeekNotice}
          volume={volume}
          muted={muted}
          onVolumeChange={(v) => applyVolume(v, v === 0)}
          onToggleMute={toggleMute}
          liveQuality={liveQuality}
          qualityOptions={qualityOptions}
          onSelectQuality={selectQuality}
          onOpenQualityMenu={() => injectPlayerCommand('window.__mobileVideoCommands&&window.__mobileVideoCommands.publishQualities&&window.__mobileVideoCommands.publishQualities();')}
          showQuality={isYouTube}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          rightSlot={chromeRightSlot}
        />
      ) : null}
      {playerError ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(8,13,25,0.82)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700', textAlign: 'center' }}>{playerError}</Text>
        </View>
      ) : null}
    </View>
  );

  if (isFullscreen) {
    return (
      <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setIsFullscreen(false)}>
        <StatusBar hidden />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'bottom', 'left', 'right']}>
          {playerBody}
        </SafeAreaView>
      </Modal>
    );
  }

  return playerBody;
}
