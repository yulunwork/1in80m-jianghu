// 《江湖蒼生錄 · 八千萬眾》水墨設色畫卷、古地圖與古琴音訊引擎

window.JianghuCanvas = (function () {
  // 繪製古羊皮水墨《九州山河武林輿圖》
  function drawJianghuMap(canvas, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = opts.width || 640);
    const h = (canvas.height = opts.height || 360);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    ctx.clearRect(0, 0, w, h);
    // 宣紙/古羊皮底色
    ctx.fillStyle = isDark ? '#171411' : '#EAE0CC';
    ctx.fillRect(0, 0, w, h);

    // 繪製九州疆域水墨塊面
    ctx.fillStyle = isDark ? '#241F1A' : '#DCD0B8';
    ctx.strokeStyle = isDark ? '#4A3E31' : '#A69374';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.10, h * 0.18);
    ctx.lineTo(w * 0.45, h * 0.08);
    ctx.lineTo(w * 0.85, h * 0.13);
    ctx.lineTo(w * 0.89, h * 0.35);
    ctx.lineTo(w * 0.78, h * 0.57);
    ctx.lineTo(w * 0.74, h * 0.80);
    ctx.lineTo(w * 0.51, h * 0.90);
    ctx.lineTo(w * 0.27, h * 0.83);
    ctx.lineTo(w * 0.12, h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 繪製古地圖山形筆觸 (崑崙、終南華山、嵩山、峨眉、長白)
    const mountains = [
      [0.22, 0.36], [0.47, 0.42], [0.55, 0.45], [0.40, 0.60], [0.76, 0.20], [0.35, 0.70]
    ];
    ctx.strokeStyle = isDark ? '#5C4D3C' : '#8C7A5B';
    ctx.lineWidth = 1.4;
    mountains.forEach(([mx, my]) => {
      const cx = mx * w;
      const cy = my * h;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy + 4);
      ctx.lineTo(cx - 6, cy - 6);
      ctx.lineTo(cx, cy + 1);
      ctx.lineTo(cx + 6, cy - 8);
      ctx.lineTo(cx + 15, cy + 4);
      ctx.stroke();
    });

    // 繪製黃河與長江水系
    ctx.strokeStyle = isDark ? '#3D5A58' : '#7A968E';
    ctx.lineWidth = 2.2;
    // 黃河
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.44);
    ctx.quadraticCurveTo(w * 0.44, h * 0.27, w * 0.50, h * 0.42);
    ctx.quadraticCurveTo(w * 0.58, h * 0.47, w * 0.73, h * 0.37);
    ctx.stroke();
    // 長江
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * 0.62);
    ctx.quadraticCurveTo(w * 0.48, h * 0.64, w * 0.56, h * 0.56);
    ctx.quadraticCurveTo(w * 0.66, h * 0.58, w * 0.78, h * 0.55);
    ctx.stroke();

    // 右上角繪製古典方位羅盤 (子午卯酉)
    const compX = w - 42;
    const compY = 42;
    ctx.strokeStyle = isDark ? '#705E48' : '#8C7658';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(compX, compY, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(compX, compY - 22);
    ctx.lineTo(compX, compY + 22);
    ctx.moveTo(compX - 22, compY);
    ctx.lineTo(compX + 22, compY);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#B5A792' : '#5C4D3C';
    ctx.font = '10px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('北', compX, compY - 24);
    ctx.textAlign = 'start';

    // 繪製各疆域節點
    const regions = window.JIANGHU_DATA.REGIONS;
    regions.forEach((r) => {
      const rx = r.coords[0] * w;
      const ry = r.coords[1] * h;
      const isHighlight = opts.highlightId === r.id;

      ctx.beginPath();
      ctx.arc(rx, ry, isHighlight ? 6 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = isHighlight
        ? '#9E2424'
        : (r.zone === '名門世家' ? '#8C6224' : '#245C4E');
      ctx.fill();

      if (isHighlight) {
        ctx.strokeStyle = '#9E2424';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(rx, ry, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = isDark ? '#F0E6D2' : '#1C1814';
        ctx.font = 'bold 12.5px "Noto Serif TC", serif';
        ctx.fillText(r.name.split(' · ')[0], rx + 10, ry + 4);
      }
    });

    // 若有足跡路線
    if (opts.trail && opts.trail.length > 1) {
      ctx.strokeStyle = '#9E2424';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      opts.trail.forEach((pt, idx) => {
        const px = pt[0] * w;
        const py = pt[1] * h;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 若有即時漣漪 (首頁動態降生/離世點)
    if (opts.pulses && opts.pulses.length) {
      opts.pulses.forEach((p) => {
        const px = p.x * w;
        const py = p.y * h;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = p.type === 'birth'
          ? `rgba(36, 92, 78, ${p.alpha})`
          : `rgba(158, 36, 36, ${p.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.type === 'birth' ? '#245C4E' : '#9E2424';
        ctx.fill();
      });
    }

    // 古地圖雙線內框
    ctx.strokeStyle = isDark ? '#4A3E31' : '#9C8869';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, w - 10, h - 10);
  }

  // 繪製水墨丹青人物小像 (隨年齡、性別、武學境界、兵刃動態變化)
  function drawPortrait(container, state) {
    if (!container) return;
    let cv = container.querySelector('canvas');
    if (!cv) {
      container.innerHTML = '';
      cv = document.createElement('canvas');
      cv.width = 36;
      cv.height = 46;
      container.appendChild(cv);
    }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 36, 46);

    const age = state.age || 0;
    const isF = state.sex === 'F';
    const martial = state.stats ? state.stats.martial : 10;

    // 宣紙底色與右上角小朱印
    ctx.fillStyle = '#EFE6D2';
    ctx.fillRect(0, 0, 36, 46);
    ctx.fillStyle = '#9E2424';
    ctx.fillRect(30, 3, 3, 5);

    // 若為高手，背後繪製淡淡水墨圓相
    if (martial >= 50) {
      ctx.fillStyle = martial >= 85 ? '#E2CFA6' : '#CFDAD4';
      ctx.fillRect(8, 7, 20, 20);
    }

    // 嬰幼兒 (0-3歲)
    if (age <= 3) {
      ctx.fillStyle = isF ? '#B84A4A' : '#2E6B5E';
      ctx.fillRect(11, 24, 14, 16);
      ctx.fillStyle = '#EAC5A4';
      ctx.fillRect(13, 15, 10, 9);
      ctx.fillStyle = '#222';
      ctx.fillRect(17, 13, 2, 2);
      ctx.fillRect(15, 19, 2, 1);
      ctx.fillRect(19, 19, 2, 1);
      return;
    }

    const hairColor = age >= 60 ? '#D8D8D8' : (age >= 45 ? '#66635E' : '#1E1B18');
    const skinColor = '#EAC5A4';

    // 古典衣袍配色
    let robeColor = '#5C5346'; // 褐衣平民
    if (martial >= 72) robeColor = '#245C4E'; // 宗師松青道袍
    else if (martial >= 32) robeColor = '#7A2323'; // 武者玄紅勁裝
    else if (state.region && state.region.zone === '名門世家') robeColor = '#8C6224';
    else if (isF) robeColor = '#8E444D';

    // 身軀與交領右衽
    ctx.fillStyle = robeColor;
    ctx.fillRect(8, 27, 20, 19);
    ctx.fillStyle = '#F5EFE0';
    ctx.fillRect(15, 27, 6, 7);
    ctx.fillStyle = robeColor;
    ctx.fillRect(17, 29, 2, 5);

    // 背後佩劍/兵刃
    if (martial >= 22 || state.weapon !== '無') {
      ctx.fillStyle = '#5C3A21';
      ctx.fillRect(26, 8, 2, 19);
      ctx.fillStyle = '#C49A45';
      ctx.fillRect(25, 11, 4, 2);
    }

    // 臉部與頸部
    ctx.fillStyle = skinColor;
    ctx.fillRect(12, 13, 12, 13);
    ctx.fillRect(15, 25, 6, 3);

    // 髮髻與冠巾
    ctx.fillStyle = hairColor;
    if (age < 13) {
      ctx.fillRect(11, 11, 14, 4);
      ctx.fillRect(9, 12, 3, 4);
      ctx.fillRect(24, 12, 3, 4);
    } else if (isF) {
      ctx.fillRect(11, 10, 14, 5);
      ctx.fillRect(10, 13, 2, 11);
      ctx.fillRect(24, 13, 2, 11);
      ctx.fillRect(14, 7, 8, 3);
      ctx.fillStyle = '#C49A45';
      ctx.fillRect(12, 8, 12, 1);
    } else {
      ctx.fillRect(11, 11, 14, 4);
      ctx.fillRect(15, 7, 6, 4);
      ctx.fillStyle = martial >= 32 ? '#9E2424' : '#3D352E';
      ctx.fillRect(14, 9, 8, 2);
    }

    // 眉目與鬍鬚
    ctx.fillStyle = '#1C1814';
    ctx.fillRect(14, 17, 2, 2);
    ctx.fillRect(20, 17, 2, 2);
    ctx.fillStyle = hairColor;
    ctx.fillRect(14, 15, 3, 1);
    ctx.fillRect(19, 15, 3, 1);

    if (!isF && age >= 30) {
      ctx.fillStyle = hairColor;
      ctx.fillRect(15, 22, 6, 1);
      if (age >= 48) {
        ctx.fillRect(16, 23, 4, 5);
      }
    } else {
      ctx.fillStyle = isF ? '#A8383B' : '#8E5B45';
      ctx.fillRect(16, 22, 4, 1);
    }
  }

  // 繪製 32:10 水墨設色山水畫卷
  function drawScene(container, state) {
    if (!container) return;
    let cv = container.querySelector('canvas');
    if (!cv) {
      container.innerHTML = '';
      cv = document.createElement('canvas');
      cv.width = 320;
      cv.height = 100;
      container.appendChild(cv);
    }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const w = 320;
    const h = 100;

    const sceneType = state.region ? state.region.sceneType : 'plains';
    const isNight = (state.age || 0) % 5 === 4;

    // 1. 宣紙設色天空
    const palettes = {
      plains:   isNight ? ['#1A1D24', '#2A2F38'] : ['#E6DEC8', '#F4EFE0'],
      jiangnan: isNight ? ['#162224', '#243638'] : ['#D8E2DC', '#F0F4F0'],
      mountain: isNight ? ['#181C24', '#272F3B'] : ['#D5DCE0', '#EDEFF0'],
      fortress: isNight ? ['#221818', '#382626'] : ['#E2D4C8', '#F0E8DF'],
      desert:   isNight ? ['#211B14', '#382E22'] : ['#E5D2B0', '#F4E8D0']
    };
    const pal = palettes[sceneType] || palettes.plains;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 落日硃砂或孤月
    ctx.fillStyle = isNight ? '#F2E5C4' : '#B8332A';
    ctx.beginPath();
    ctx.arc(262, 24, isNight ? 9 : 11, 0, Math.PI * 2);
    ctx.fill();

    // 2. 水墨遠山與雲氣
    ctx.fillStyle = isNight ? '#252B30' : '#9AA6A0';
    ctx.beginPath();
    ctx.moveTo(0, 72);
    for (let x = 0; x <= w; x += 40) {
      const peak = sceneType === 'mountain' ? 24 + (x % 3) * 10 : 50 + (x % 2) * 8;
      ctx.lineTo(x + 20, peak);
      ctx.lineTo(x + 40, 72);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // 山間雲霧留白帶
    ctx.fillStyle = isNight ? 'rgba(255,255,255,0.05)' : 'rgba(248,243,230,0.55)';
    ctx.fillRect(0, 56, w, 6);

    // 3. 地域風物前景
    if (sceneType === 'jiangnan') {
      ctx.fillStyle = isNight ? '#1B2E32' : '#769892';
      ctx.fillRect(0, 72, w, 28);
      // 江南飛簷白牆與烏篷船
      ctx.fillStyle = isNight ? '#8B9492' : '#F6F5F0';
      ctx.fillRect(34, 48, 38, 24);
      ctx.fillStyle = '#262A2B';
      ctx.fillRect(30, 44, 46, 5);
      // 石拱橋
      ctx.fillStyle = '#707876';
      ctx.fillRect(190, 66, 56, 8);
      ctx.fillStyle = isNight ? '#122024' : '#52736E';
      ctx.beginPath();
      ctx.arc(218, 74, 14, Math.PI, 0);
      ctx.fill();
    } else if (sceneType === 'fortress') {
      ctx.fillStyle = isNight ? '#2B2522' : '#85776C';
      ctx.fillRect(0, 55, 132, 23);
      for (let x = 4; x < 128; x += 12) {
        ctx.fillRect(x, 50, 7, 5);
      }
      // 城頭戰旗
      ctx.fillStyle = '#9E2424';
      ctx.fillRect(88, 30, 20, 11);
      ctx.fillStyle = '#2B2118';
      ctx.fillRect(86, 28, 2, 26);
      ctx.fillStyle = isNight ? '#222620' : '#788268';
      ctx.fillRect(0, 74, w, 26);
    } else if (sceneType === 'desert') {
      ctx.fillStyle = isNight ? '#362C20' : '#C4A676';
      ctx.fillRect(0, 70, w, 30);
      ctx.fillStyle = '#EAE2D2';
      ctx.beginPath();
      ctx.arc(64, 70, 20, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#9E2424';
      ctx.fillRect(58, 60, 12, 10);
    } else {
      // 中原茅屋與古松
      ctx.fillStyle = isNight ? '#202B22' : '#748C6E';
      ctx.fillRect(0, 72, w, 28);
      ctx.fillStyle = '#85653E';
      ctx.fillRect(46, 54, 32, 18);
      ctx.fillStyle = '#4F3B22';
      ctx.beginPath();
      ctx.moveTo(40, 54);
      ctx.lineTo(62, 39);
      ctx.lineTo(84, 54);
      ctx.fill();
    }

    // 4. 繪製主角與俠侶身影
    const px = 152;
    const py = 58;
    ctx.fillStyle = '#EAC5A4';
    ctx.fillRect(px, py, 6, 6);
    ctx.fillStyle = (state.stats && state.stats.martial >= 40) ? '#245C4E' : '#9E2424';
    ctx.fillRect(px - 1, py + 6, 8, 11);
    ctx.fillStyle = '#1E1B18';
    ctx.fillRect(px, py - 2, 6, 2);

    if (state.focus === 'outer' || state.focus === 'chivalry' || (state.stats && state.stats.martial >= 32)) {
      ctx.fillStyle = '#D8DEE0';
      ctx.fillRect(px + 8, py + 4, 15, 2);
      ctx.fillStyle = '#C49A45';
      ctx.fillRect(px + 7, py + 2, 2, 6);
    }

    if (state.spouse && state.spouse.alive) {
      ctx.fillStyle = '#EAC5A4';
      ctx.fillRect(px - 14, py + 1, 6, 6);
      ctx.fillStyle = '#9E3B42';
      ctx.fillRect(px - 15, py + 7, 8, 10);
      ctx.fillStyle = '#1E1B18';
      ctx.fillRect(px - 14, py - 1, 6, 2);
    }
  }

  return {
    drawJianghuMap,
    drawPortrait,
    drawScene
  };
})();

// WebAudio 古琴與洞簫雅樂合成器
window.JianghuAudio = (function () {
  let ctx = null;
  let playing = false;
  let timer = null;
  const scale = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00];

  function init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function pluckNote(freq, dur = 2.8, vol = 0.08) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  function toggleMusic() {
    init();
    playing = !playing;
    if (playing) {
      pluckNote(196.0, 3.2, 0.09);
      timer = setInterval(() => {
        if (!playing) return;
        const f = scale[Math.floor(Math.random() * scale.length)];
        pluckNote(f, 3.0 + Math.random() * 1.5, 0.06);
        if (Math.random() < 0.35) {
          setTimeout(() => pluckNote(f * 1.5, 2.4, 0.04), 420);
        }
      }, 2200);
    } else if (timer) {
      clearInterval(timer);
      timer = null;
    }
    return playing;
  }

  function playChime(type = 'tick') {
    if (!ctx || !playing) return;
    if (type === 'birth') {
      pluckNote(261.63, 2.0, 0.09);
      setTimeout(() => pluckNote(329.63, 2.4, 0.09), 220);
      setTimeout(() => pluckNote(392.00, 3.0, 0.1), 460);
    } else if (type === 'decision') {
      pluckNote(220.0, 1.5, 0.07);
    }
  }

  return {
    toggleMusic,
    playChime,
    isPlaying: () => playing
  };
})();
