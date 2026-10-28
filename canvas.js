// 《八千萬分之1 · 江湖蒼生錄》視覺繪圖與古琴音訊引擎

window.JianghuCanvas = (function () {
  // 繪製九州江湖輿圖 (首頁即時動態地圖 / 出生戶帖地圖 / 命終足跡地圖)
  function drawJianghuMap(canvas, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = opts.width || 640);
    const h = (canvas.height = opts.height || 360);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#121A1E' : '#E5ECE8';
    ctx.fillRect(0, 0, w, h);

    // 繪製疆域大陸輪廓 (簡化水墨九州塊面)
    ctx.fillStyle = isDark ? '#212E34' : '#CBD6D1';
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.20);
    ctx.lineTo(w * 0.45, h * 0.08);
    ctx.lineTo(w * 0.84, h * 0.14);
    ctx.lineTo(w * 0.88, h * 0.34);
    ctx.lineTo(w * 0.78, h * 0.56);
    ctx.lineTo(w * 0.74, h * 0.78);
    ctx.lineTo(w * 0.52, h * 0.88);
    ctx.lineTo(w * 0.28, h * 0.82);
    ctx.lineTo(w * 0.14, h * 0.58);
    ctx.closePath();
    ctx.fill();

    // 繪製黃河與長江水系
    ctx.strokeStyle = isDark ? '#324B54' : '#9BB2AC';
    ctx.lineWidth = 2.2;
    // 黃河
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h * 0.44);
    ctx.quadraticCurveTo(w * 0.44, h * 0.28, w * 0.50, h * 0.42);
    ctx.quadraticCurveTo(w * 0.58, h * 0.47, w * 0.72, h * 0.37);
    ctx.stroke();
    // 長江
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.62);
    ctx.quadraticCurveTo(w * 0.48, h * 0.64, w * 0.56, h * 0.56);
    ctx.quadraticCurveTo(w * 0.66, h * 0.58, w * 0.77, h * 0.55);
    ctx.stroke();

    // 繪製各疆域節點
    const regions = window.JIANGHU_DATA.REGIONS;
    ctx.font = '11px "Noto Sans TC", sans-serif';
    regions.forEach((r) => {
      const rx = r.coords[0] * w;
      const ry = r.coords[1] * h;
      const isHighlight = opts.highlightId === r.id;

      ctx.beginPath();
      ctx.arc(rx, ry, isHighlight ? 6 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = isHighlight
        ? '#8C1D3C'
        : (r.zone === '名門世家' ? '#9C7020' : '#0F6E68');
      ctx.fill();

      if (isHighlight) {
        ctx.strokeStyle = '#8C1D3C';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(rx, ry, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = isDark ? '#F0F4F2' : '#142026';
        ctx.font = 'bold 12px "Noto Serif TC", serif';
        ctx.fillText(r.name.split(' · ')[0], rx + 9, ry + 4);
      }
    });

    // 若有足跡路線 (命終卷宗)
    if (opts.trail && opts.trail.length > 1) {
      ctx.strokeStyle = '#8C1D3C';
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
          ? `rgba(15, 110, 104, ${p.alpha})`
          : `rgba(140, 29, 60, ${p.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.type === 'birth' ? '#0F6E68' : '#8C1D3C';
        ctx.fill();
      });
    }
  }

  // 繪製 68x86 江湖身契像素肖像 (隨年齡、性別、武學境界、兵刃動態變化)
  function drawPortrait(container, state) {
    if (!container) return;
    let cv = container.querySelector('canvas');
    if (!cv) {
      container.innerHTML = '';
      cv = document.createElement('canvas');
      cv.width = 34;
      cv.height = 43;
      container.appendChild(cv);
    }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 34, 43);

    const age = state.age || 0;
    const isF = state.sex === 'F';
    const martial = state.stats ? state.stats.martial : 10;

    // 背景底色
    ctx.fillStyle = martial >= 70 ? '#DFECE8' : '#EAECE7';
    ctx.fillRect(0, 0, 34, 43);

    // 若為絕頂高手，背後繪製淡淡太極/劍氣光暈
    if (martial >= 52) {
      ctx.fillStyle = martial >= 85 ? '#EED9B3' : '#CFE4DF';
      ctx.fillRect(7, 6, 20, 20);
    }

    // 嬰幼兒 (0-3歲)
    if (age <= 3) {
      // 襁褓
      ctx.fillStyle = isF ? '#C95B6E' : '#3C7A74';
      ctx.fillRect(10, 22, 14, 16);
      ctx.fillStyle = '#F2D2B6';
      ctx.fillRect(12, 14, 10, 9);
      // 眼睛與胎毛
      ctx.fillStyle = '#222';
      ctx.fillRect(16, 12, 2, 2);
      ctx.fillRect(14, 18, 2, 1);
      ctx.fillRect(18, 18, 2, 1);
      return;
    }

    // 決定髮色與膚色
    const hairColor = age >= 60 ? '#D8D8D8' : (age >= 45 ? '#666B6E' : '#1F2426');
    const skinColor = '#EAC5A4';

    // 衣袍顏色
    let robeColor = '#5E6B66'; // 平民布衣
    if (martial >= 72) robeColor = '#1E4E4A'; // 宗師青衫
    else if (martial >= 35) robeColor = '#8C1D3C'; // 勁裝
    else if (state.region && state.region.zone === '名門世家') robeColor = '#8A6828';
    else if (isF) robeColor = '#9B4F62';

    // 身體與衣襟
    ctx.fillStyle = robeColor;
    ctx.fillRect(7, 26, 20, 17);
    // 交領白色內襯
    ctx.fillStyle = '#F4F4F0';
    ctx.fillRect(14, 26, 6, 6);
    ctx.fillStyle = robeColor;
    ctx.fillRect(16, 28, 2, 4);

    // 背後兵刃 (若武學 >= 25 或配有兵刃)
    if (martial >= 25 || state.weapon !== '無') {
      ctx.fillStyle = '#8C6239';
      ctx.fillRect(25, 8, 2, 18);
      ctx.fillStyle = '#D9AF59';
      ctx.fillRect(24, 11, 4, 2);
    }

    // 臉龐
    ctx.fillStyle = skinColor;
    ctx.fillRect(11, 12, 12, 13);
    // 脖子
    ctx.fillRect(14, 24, 6, 3);

    // 髮型與頭冠
    ctx.fillStyle = hairColor;
    if (age < 13) {
      // 垂髫雙髻
      ctx.fillRect(10, 10, 14, 4);
      ctx.fillRect(8, 11, 3, 4);
      ctx.fillRect(23, 11, 3, 4);
    } else if (isF) {
      // 女子雲鬢與髮簪
      ctx.fillRect(10, 9, 14, 5);
      ctx.fillRect(9, 12, 2, 10);
      ctx.fillRect(23, 12, 2, 10);
      ctx.fillRect(13, 6, 8, 3);
      ctx.fillStyle = '#D9AF59';
      ctx.fillRect(11, 7, 12, 1);
    } else {
      // 男子束髮道冠/英雄巾
      ctx.fillRect(10, 10, 14, 4);
      ctx.fillRect(14, 6, 6, 4);
      ctx.fillStyle = martial >= 32 ? '#8C1D3C' : '#3A4A4E';
      ctx.fillRect(13, 8, 8, 2);
    }

    // 五官
    ctx.fillStyle = '#1B2224';
    ctx.fillRect(13, 16, 2, 2);
    ctx.fillRect(19, 16, 2, 2);
    // 眉毛
    ctx.fillStyle = hairColor;
    ctx.fillRect(13, 14, 3, 1);
    ctx.fillRect(18, 14, 3, 1);

    // 嘴與鬍鬚
    if (!isF && age >= 32) {
      ctx.fillStyle = hairColor;
      ctx.fillRect(14, 21, 6, 1);
      if (age >= 50) {
        ctx.fillRect(15, 22, 4, 5);
      }
    } else {
      ctx.fillStyle = isF ? '#B5485A' : '#9E6B55';
      ctx.fillRect(15, 21, 4, 1);
    }
  }

  // 繪製 32:10 橫幅江湖場景 (依地域、年齡、重心繪製水墨像素風畫卷)
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

    // 1. 天空漸層
    const palettes = {
      plains:   isNight ? ['#1A232C', '#2B3945'] : ['#D8E4DD', '#EFECE0'],
      jiangnan: isNight ? ['#162629', '#263E42'] : ['#CFE3DF', '#E8F1EE'],
      mountain: isNight ? ['#181F28', '#293542'] : ['#CBD9E0', '#E4ECEF'],
      fortress: isNight ? ['#241B1E', '#3A2A2D'] : ['#DFD3CC', '#EDE5DF'],
      desert:   isNight ? ['#221D18', '#3B3126'] : ['#E6D5B8', '#F2E8D5']
    };
    const pal = palettes[sceneType] || palettes.plains;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 太陽或明月
    ctx.fillStyle = isNight ? '#F4EBC3' : '#C84B31';
    ctx.beginPath();
    ctx.arc(265, 24, isNight ? 9 : 11, 0, Math.PI * 2);
    ctx.fill();

    // 2. 遠山層次
    ctx.fillStyle = isNight ? '#253138' : '#9FB3AD';
    ctx.beginPath();
    ctx.moveTo(0, 72);
    for (let x = 0; x <= w; x += 40) {
      const peak = sceneType === 'mountain' ? 28 + (x % 3) * 10 : 52 + (x % 2) * 8;
      ctx.lineTo(x + 20, peak);
      ctx.lineTo(x + 40, 72);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // 3. 地面與建築細節
    if (sceneType === 'jiangnan') {
      // 江南水鄉：河道、石拱橋、白牆黛瓦
      ctx.fillStyle = isNight ? '#1D3338' : '#7FA8A3';
      ctx.fillRect(0, 72, w, 28);
      // 白牆屋舍
      ctx.fillStyle = isNight ? '#8B9694' : '#F4F6F4';
      ctx.fillRect(36, 48, 38, 24);
      ctx.fillStyle = '#2B3537';
      ctx.fillRect(32, 44, 46, 6);
      // 拱橋
      ctx.fillStyle = '#7A8482';
      ctx.fillRect(190, 66, 56, 8);
      ctx.fillStyle = isNight ? '#122226' : '#567E79';
      ctx.beginPath();
      ctx.arc(218, 74, 14, Math.PI, 0);
      ctx.fill();
    } else if (sceneType === 'fortress') {
      // 襄陽/城池：城牆與垛口、旌旗
      ctx.fillStyle = isNight ? '#2E2A27' : '#8C827A';
      ctx.fillRect(0, 56, 130, 22);
      for (let x = 4; x < 126; x += 12) {
        ctx.fillRect(x, 51, 7, 5);
      }
      // 帥旗
      ctx.fillStyle = '#8C1D3C';
      ctx.fillRect(88, 32, 18, 10);
      ctx.fillStyle = '#333';
      ctx.fillRect(87, 30, 2, 24);
      ctx.fillStyle = isNight ? '#242B24' : '#7D8C73';
      ctx.fillRect(0, 74, w, 26);
    } else if (sceneType === 'desert') {
      // 塞外大漠：沙丘與蒙古包
      ctx.fillStyle = isNight ? '#382F24' : '#C9AE82';
      ctx.fillRect(0, 70, w, 30);
      // 氈帳
      ctx.fillStyle = '#E8E2D5';
      ctx.beginPath();
      ctx.arc(64, 70, 20, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#8C1D3C';
      ctx.fillRect(58, 60, 12, 10);
    } else {
      // 中原農田/山林古剎
      ctx.fillStyle = isNight ? '#223026' : '#7A9A76';
      ctx.fillRect(0, 72, w, 28);
      // 茅屋或山亭
      ctx.fillStyle = '#8C6D46';
      ctx.fillRect(46, 54, 32, 18);
      ctx.fillStyle = '#5C462C';
      ctx.beginPath();
      ctx.moveTo(40, 54);
      ctx.lineTo(62, 40);
      ctx.lineTo(84, 54);
      ctx.fill();
    }

    // 4. 繪製主角小人與當前動作 (中景位置 x=148, y=58)
    const px = 152;
    const py = 58;
    ctx.fillStyle = '#EAC5A4';
    ctx.fillRect(px, py, 6, 6); // 頭
    ctx.fillStyle = (state.stats && state.stats.martial >= 40) ? '#0F6E68' : '#8C1D3C';
    ctx.fillRect(px - 1, py + 6, 8, 11); // 身
    ctx.fillStyle = '#1F2426';
    ctx.fillRect(px, py - 2, 6, 2); // 髮

    // 若習武或練劍，畫出手中長劍與劍氣
    if (state.focus === 'outer' || state.focus === 'chivalry' || (state.stats && state.stats.martial >= 35)) {
      ctx.fillStyle = '#D9DEE0';
      ctx.fillRect(px + 8, py + 4, 14, 2);
      ctx.fillStyle = '#D9AF59';
      ctx.fillRect(px + 7, py + 2, 2, 6);
    }

    // 若已成婚，身旁繪製伴侶小人
    if (state.spouse && state.spouse.alive) {
      ctx.fillStyle = '#EAC5A4';
      ctx.fillRect(px - 14, py + 1, 6, 6);
      ctx.fillStyle = '#B5485A';
      ctx.fillRect(px - 15, py + 7, 8, 10);
      ctx.fillStyle = '#1F2426';
      ctx.fillRect(px - 14, py - 1, 6, 2);
    }
  }

  return {
    drawJianghuMap,
    drawPortrait,
    drawScene
  };
})();

// WebAudio 古琴與洞簫雅樂合成器（免外部音檔、純程式碼生成宮商角徵羽泛音）
window.JianghuAudio = (function () {
  let ctx = null;
  let playing = false;
  let timer = null;
  // 古琴五聲調式頻率 (C宮 D商 E角 G徵 A羽)
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
