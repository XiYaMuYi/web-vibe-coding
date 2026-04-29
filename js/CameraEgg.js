const CameraEgg = (() => {
  let stream = null;
  let video = null;
  let canvas = null;
  let ctx = null;

  function ensureCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    return { canvas, ctx };
  }

  async function startCamera({ videoEl } = {}) {
    video = videoEl ?? document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.classList.remove('hidden');

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      return video;
    } catch (error) {
      if (video) video.classList.add('hidden');
      throw new Error('摄像头权限被拒绝或不可用');
    }
  }

  async function submitAvatar(base64Image) {
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Image }),
    });
    return response.json();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  function buildCard({ identityCode = 'ID-0001', title = '专属身份代号', subtitle = 'SURPRISE FILE', footer = 'VIBE CODING ECHO UNIT' } = {}) {
    if (!video || video.readyState < 2) throw new Error('Camera is not ready');

    const { canvas: workCanvas, ctx: workCtx } = ensureCanvas();
    const width = 1080;
    const height = 1440;
    const footerHeight = 260;
    const photoHeight = height - footerHeight;

    workCanvas.width = width;
    workCanvas.height = height;

    workCtx.drawImage(video, 0, 0, width, photoHeight);

    const grad = workCtx.createLinearGradient(0, photoHeight - 180, 0, height);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(4, 8, 18, 0.95)');
    workCtx.fillStyle = grad;
    workCtx.fillRect(0, photoHeight - 180, width, footerHeight + 180);

    workCtx.strokeStyle = '#00f5ff';
    workCtx.lineWidth = 8;
    workCtx.shadowColor = 'rgba(0,245,255,0.85)';
    workCtx.shadowBlur = 24;
    workCtx.strokeRect(28, 28, width - 56, height - 56);

    workCtx.shadowBlur = 0;
    workCtx.fillStyle = 'rgba(255,255,255,0.92)';
    workCtx.font = 'bold 56px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    workCtx.fillText(title, 56, height - 170);

    workCtx.fillStyle = '#7df9ff';
    workCtx.font = '900 76px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    workCtx.fillText(identityCode, 56, height - 90);

    workCtx.fillStyle = 'rgba(255,255,255,0.72)';
    workCtx.font = '500 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    workCtx.fillText(subtitle, 58, height - 42);

    workCtx.strokeStyle = 'rgba(125,249,255,0.7)';
    workCtx.lineWidth = 4;
    workCtx.beginPath();
    workCtx.moveTo(56, photoHeight + 18);
    workCtx.lineTo(width - 56, photoHeight + 18);
    workCtx.stroke();

    workCtx.fillStyle = 'rgba(255,255,255,0.45)';
    workCtx.font = '400 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    workCtx.fillText(footer, 56, height - 12);

    return workCanvas.toDataURL('image/png');
  }

  function downloadCard(dataUrl, filename = 'identity-card.png') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return { startCamera, stopCamera, buildCard, downloadCard, submitAvatar, showModal: () => window.AppController?.showCameraModal?.() };
})();

window.CameraEgg = CameraEgg;
