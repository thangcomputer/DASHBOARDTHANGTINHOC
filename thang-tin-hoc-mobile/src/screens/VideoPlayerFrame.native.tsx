import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { typography } from '../theme/tokens';
import { getMobileApiBaseUrl } from '../services/apiClient';
import { noteStudyMediaProgress } from '../services/studyActivity';
import { createVideoWatchGuard } from './videoWatchGuard';
import { isDirectVideoUrl, vimeoIdFromUrl, youtubeIdFromUrl } from '../utils/videoSource';
import type { VideoPlayerApi, VideoPlayerProgress } from './VideoPlayerFrame';

type PlayerMessage =
  | ({ type: 'progress'; eligible?: boolean } & VideoPlayerProgress)
  | { type: 'error'; message: string };

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
}: {
  videoUrl: string;
  embeddedUrl: string;
  title: string;
  lessonId: string;
  antiSeekEnabled: boolean;
  done: boolean;
  origin: string;
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
    isDirectVideo: JSON.stringify(isDirectVideo),
    youtubeId: escapedScriptValue(youtubeId),
    vimeoId: escapedScriptValue(vimeoId),
  };
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="origin">
<style>html,body,#player{margin:0;width:100%;height:100%;overflow:hidden;background:#080D19}video,#player iframe{width:100%!important;height:100%!important;border:0!important;object-fit:contain}</style>
</head><body><div id="player"></div><script>
(function(){
  const videoUrl=${encoded.videoUrl};
  const embeddedUrl=${encoded.embeddedUrl};
  const title=${encoded.title};
  const lessonId=${encoded.lessonId};
  const origin=${encoded.origin};
  let antiSeekEnabled=${encoded.antiSeekEnabled};
  let completed=${encoded.done};
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
  function send(value){window.ReactNativeWebView.postMessage(JSON.stringify(value));}
  function report(time,duration,isPlaying,seek){
    const tick=guard.tick(time,duration,isPlaying,antiSeekEnabled,completed||thresholdReached);
    if(tick.seekTo!==null){seek(tick.seekTo);return;}
    const now=Date.now();
    if(!completed&&now-lastSaved>=1000){
      lastSaved=now;
      try{localStorage.setItem(watchKey,String(tick.maxPosition));localStorage.setItem(watchedKey,String(tick.watchedSeconds));}
      catch(error){console.error('Không thể lưu tiến độ video đã xem.',error);}
    }
    const progress={type:'progress',currentTime:time,duration:duration,watchedSeconds:tick.watchedSeconds,completed:completed,playing:isPlaying};
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
    video=document.createElement('video');video.src=videoUrl;video.controls=true;video.autoplay=true;video.playsInline=true;video.setAttribute('controlsList','nodownload noplaybackrate');video.setAttribute('aria-label',title);document.getElementById('player').appendChild(video);
    video.addEventListener('loadedmetadata',function(){if(!completed&&initialMaxPosition>0)video.currentTime=Math.min(initialMaxPosition,Math.max(0,video.duration-1));});
    video.addEventListener('play',function(){playing=true;});
    video.addEventListener('pause',function(){playing=false;});
    video.addEventListener('seeked',poll);
  }else if(youtubeId){
    function initializePlayer(){
      const target=document.getElementById('player');
      if(!target||!window.YT||!window.YT.Player)return;
      const playerFrame=document.createElement('iframe');
      playerFrame.referrerPolicy='origin';
      playerFrame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      playerFrame.allowFullscreen=true;
      playerFrame.title=title;
      playerFrame.style.width='100%';
      playerFrame.style.height='100%';
      playerFrame.style.border='0';
      playerFrame.src='https://www.youtube.com/embed/'+encodeURIComponent(youtubeId)+'?autoplay=1&controls=1&rel=0&playsinline=1&enablejsapi=1&origin='+encodeURIComponent(origin)+'&start='+Math.floor(initialMaxPosition);
      target.appendChild(playerFrame);
      player=new window.YT.Player(playerFrame,{videoId:youtubeId,playerVars:{autoplay:1,controls:1,rel:0,playsinline:1,enablejsapi:1,origin:origin,start:Math.floor(initialMaxPosition)},events:{
        onReady:function(event){
          const iframe=event.target.getIframe();
          iframe.referrerPolicy='origin';
          iframe.style.width='100%';
          iframe.style.height='100%';
          iframe.style.border='0';
          if(!completed&&initialMaxPosition>0)event.target.seekTo(initialMaxPosition,true);
          poll();
        },
        onStateChange:function(event){playing=event.data===window.YT.PlayerState.PLAYING;},
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
}) {
  const [playerError, setPlayerError] = useState('');
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
  const source = useMemo(() => {
    const apiOrigin = new URL(getMobileApiBaseUrl()).origin;
    return {
      html: createPlayerHtml({ videoUrl, embeddedUrl, title, lessonId, antiSeekEnabled, done, origin: apiOrigin }),
      baseUrl: apiOrigin,
    };
  }, [videoUrl, embeddedUrl, title, lessonId, antiSeekEnabled]);
  onProgressRef.current = onProgress;
  onWatchedRef.current = onWatched;
  doneRef.current = done;

  useEffect(() => {
    const api: VideoPlayerApi = {
      getCurrentTime: () => progressRef.current.currentTime,
      getDuration: () => progressRef.current.duration,
    };
    if (playerApiRef) playerApiRef.current = api;
    return () => {
      if (playerApiRef?.current === api) playerApiRef.current = null;
    };
  }, [playerApiRef]);

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
    const progress: VideoPlayerProgress = {
      currentTime: Number(message.currentTime) || 0,
      duration: Number(message.duration) || 0,
      watchedSeconds: Number(message.watchedSeconds) || 0,
      completed: Boolean(message.completed),
      playing: Boolean(message.playing),
    };
    progressRef.current = progress;
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

  return (
    <View style={{ flex: 1, position: 'relative', backgroundColor: '#080D19' }}>
      <WebView
        source={source}
        style={{ flex: 1, backgroundColor: '#080D19' }}
        onMessage={handleMessage}
        onError={(event) => {
          const description = event.nativeEvent.description || 'Không thể tải trình phát video.';
          setPlayerError(description);
        }}
        accessibilityLabel={title}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        startInLoadingState
      />
      {playerError ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(8,13,25,0.82)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700', textAlign: 'center' }}>{playerError}</Text>
        </View>
      ) : null}
    </View>
  );
}
