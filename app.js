// 《八千萬分之1 · 江湖蒼生錄》主程式邏輯
// 致敬 1in8b.life (Jin's Earth) 與 金庸武俠世界

(function () {
  const DATA = window.JIANGHU_DATA;

  // 遊戲設定與當前角色狀態
  const cfg = {
    era: 'south_song',
    mode: 'birth', // 'birth' | 'pop' | 'hero'
    pace: 30,      // 15 | 30 | 60 (影響每年毫秒數)
    home: 'tw',
    pauseReflect: true
  };

  let life = null;
  let simTimer = null;
  let progTimer = null;
  let yearProgress = 0;
  let paused = false;
  let speed = 1;
  let autoDecide = false;
  let fastForwarding = false;
  let pendingDecision = null;

  // 首頁計數器與地圖漣漪
  let introBirths = 0;
  let introDeaths = 0;
  const mapPulses = [];

  // DOM 輔助
  const $ = (id) => document.getElementById(id);

  function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, v));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function showToast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.hidden = true; }, 2800);
  }

  // 根據武學數值取得武學境界
  function getRealm(martial) {
    let cur = DATA.REALMS[0];
    for (const r of DATA.REALMS) {
      if (martial >= r.min) cur = r;
    }
    return cur;
  }

  // 計算特定地區在某年齡的存活率 (0~100%)
  function calcSurvivalRate(region, sex, age) {
    const le = sex === 'F' ? region.leF : region.leM;
    const u5 = region.u5Mort / 100;
    if (age <= 0) return 100;
    if (age <= 5) {
      return Math.round((1 - u5 * (age / 5)) * 100);
    }
    const post5 = 1 - u5;
    // Gompertz-like 簡化衰減曲線
    const halfAge = le + 4;
    const k = 0.085;
    const s = post5 / (1 + Math.exp(k * (age - halfAge)));
    return clamp(Math.round(s * 100), 0, 100);
  }

  // 根據模式抽取降生疆域與門第
  function rollRegion(mode = cfg.mode) {
    const list = DATA.REGIONS;
    const weights = list.map((r) => {
      if (mode === 'hero') {
        // 俠客機緣模式：大幅提高武林門派與世家權重
        if (r.zone === '名門世家') return r.birthShare * 8;
        if (r.zone === '江湖底層') return r.birthShare * 3.5;
        return r.birthShare * 0.55;
      }
      return mode === 'pop' ? r.popShare : r.birthShare;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let rnd = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      rnd -= weights[i];
      if (rnd <= 0) return { region: list[i], prob: (weights[i] / total) * 100 };
    }
    return { region: list[0], prob: (weights[0] / total) * 100 };
  }

  // 產生符合出身的姓名
  function genName(region, sex) {
    if (region.id === 'mongol_steppe') {
      return pick(sex === 'F' ? DATA.STEPPE_F : DATA.STEPPE_M);
    }
    let surname = pick(DATA.SURNAMES);
    if (region.id === 'murong_dali_noble') {
      surname = Math.random() < 0.5 ? '慕容' : '段';
    }
    const isElite = region.zone === '名門世家' || region.literacy >= 55;
    const pool = sex === 'F'
      ? (isElite ? DATA.GIVEN_F_ELITE : DATA.GIVEN_F_COMMON)
      : (isElite ? DATA.GIVEN_M_ELITE : DATA.GIVEN_M_COMMON);
    return surname + pick(pool);
  }

  // 生成 MRZ 魚鱗冊雙行機器碼 (致敬 1in8b 護照底部碼)
  function buildMRZ(p) {
    const eraCode = p.eraKey === 'north_song' ? 'NSONG' : (p.eraKey === 'south_song' ? 'SSONG' : 'YUANM');
    const rCode = p.region.code || 'JHU';
    const sexChar = p.sex || 'M';
    const byr = String(p.birthYear).padStart(4, '0');
    const idNum = String(p.serial).padStart(6, '0');
    const realmIdx = DATA.REALMS.findIndex((r) => r.name === getRealm(p.stats.martial).name);
    const line1 = `JH<${eraCode}<<${rCode}<<${p.idAscii}<<<<<<<<<<<<<<<<<<<<`.slice(0, 42);
    const line2 = `${idNum}${byr}${sexChar}RLM0${Math.max(0, realmIdx)}<<<JIANGHU1IN80M<<<<08`.slice(0, 42);
    return `${line1}<br>${line2}`;
  }

  // 產生同辰降生的另外 4 位蒼生
  function generatePeers(eraObj, birthYear) {
    const peers = [];
    for (let i = 0; i < 4; i++) {
      const { region } = rollRegion('birth');
      const sex = Math.random() < 0.49 ? 'F' : 'M';
      const name = genName(region, sex);
      // 決定此同輩的預定壽元與人生軌跡
      const le = sex === 'F' ? region.leF : region.leM;
      let deathAge;
      if (Math.random() * 100 < region.u5Mort) {
        deathAge = Math.floor(Math.random() * 5);
      } else {
        const spread = (Math.random() - 0.45) * 34;
        deathAge = clamp(Math.round(le + spread), 6, 89);
      }
      const hasMartial = Math.random() * 100 < region.martialRate;
      const sect = hasMartial ? pick(region.sectPool) : region.stratum;
      const art = hasMartial ? pick(region.artsPool) : '無';
      const deathCause = deathAge <= 5 ? '幼年風寒與飢饉早夭' : pick(region.causes);

      peers.push({
        name,
        sex,
        region,
        sect,
        art,
        deathAge,
        deathCause,
        alive: true,
        statusText: '呱呱墜地，在母親懷中啼哭'
      });
    }
    return peers;
  }

  // 建立新角色生命狀態
  function createNewLife() {
    let eraKey = cfg.era;
    if (eraKey === 'any') {
      eraKey = pick(['north_song', 'south_song', 'yuan_ming']);
    }
    const eraObj = DATA.ERAS[eraKey];
    const birthYear = eraObj.years[0] + Math.floor(Math.random() * (eraObj.years[1] - eraObj.years[0]));
    const reignName = pick(eraObj.reignPrefix);
    const { region, prob } = rollRegion(cfg.mode);
    const sex = Math.random() < 0.49 ? 'F' : 'M';
    const name = genName(region, sex);

    // 依家庭吉尼係數隨機家庭富裕階層
    const wealthRoll = Math.random();
    let familyTier = '尋常溫飽';
    let incomeMult = 1.0;
    if (region.zone === '名門世家') {
      familyTier = '鐘鳴鼎食 · 武林名門';
      incomeMult = 1.6;
    } else if (wealthRoll < 0.35) {
      familyTier = '家徒四壁 · 貧苦赤貧';
      incomeMult = 0.55;
    } else if (wealthRoll > 0.88) {
      familyTier = '殷實富戶 · 頗有餘財';
      incomeMult = 1.85;
    }

    const baseMartial = region.zone === '名門世家' ? 18 : (region.zone === '江湖底層' ? 10 : 2);
    const shichenList = ['子時', '丑時', '寅時', '卯時', '辰時', '巳時', '午時', '未時', '申時', '酉時', '戌時', '亥時'];

    return {
      serial: Math.floor(100000 + Math.random() * 899999),
      idAscii: region.code + String(Math.floor(1000 + Math.random() * 9000)),
      name,
      sex,
      eraKey,
      eraObj,
      birthYear,
      reignName,
      shichen: pick(shichenList),
      region,
      birthProb: prob,
      familyTier,
      incomeMult,
      age: 0,
      alive: true,
      deathCause: '',
      sect: region.zone === '名門世家' ? pick(region.sectPool) : '尚無門派（白身）',
      weapon: region.zone === '名門世家' ? '家傳青鋒劍' : '無',
      topArt: region.zone === '名門世家' ? pick(region.artsPool) : '無',
      focus: 'survive',
      silver: Math.round(region.incomeSilver * incomeMult * 0.8),
      annualIncome: Math.round(region.incomeSilver * incomeMult * 10) / 10,
      passiveIncome: 0,
      stats: {
        health: clamp(Math.round(68 + (Math.random() - 0.4) * 24)),
        mind: clamp(Math.round(65 + (Math.random() - 0.4) * 24)),
        martial: baseMartial,
        bonds: clamp(Math.round(70 + (Math.random() - 0.3) * 20))
      },
      family: {
        father: { name: region.name.slice(0, 2) + '父', alive: true, deathAge: 42 + Math.floor(Math.random() * 26) },
        mother: { name: region.name.slice(0, 2) + '母', alive: true, deathAge: 45 + Math.floor(Math.random() * 28) },
        master: null,
        spouse: null,
        children: []
      },
      peers: generatePeers(eraObj, birthYear),
      logs: [],
      grid: [], // 每年一格紀錄 { age, state, badge, note }
      trail: [[region.coords[0], region.coords[1]]],
      usedDecisions: {},
      reflections: {}
    };
  }

  // ==================== 首頁初始化與互動 ====================
  function renderIntroOdds() {
    const box = $('oddsList');
    if (!box) return;
    const list = DATA.REGIONS.slice().sort((a, b) => {
      const va = cfg.mode === 'pop' ? a.popShare : a.birthShare;
      const vb = cfg.mode === 'pop' ? b.popShare : b.birthShare;
      return vb - va;
    });

    const top8 = list.slice(0, 8);
    const maxVal = Math.max(...top8.map((r) => (cfg.mode === 'pop' ? r.popShare : r.birthShare)));

    box.innerHTML = top8.map((r) => {
      const val = cfg.mode === 'pop' ? r.popShare : r.birthShare;
      const pct = Math.min(100, Math.round((val / maxVal) * 100));
      const isRare = r.zone === '名門世家';
      return `<div class="orow">
        <span class="nm-o" title="${r.name}">${r.name}</span>
        <div class="bar"><i class="${isRare ? 'rare' : ''}" style="width:${pct}%"></i></div>
        <span class="v">${val.toFixed(1)}%</span>
      </div>`;
    }).join('') + `<div class="orow">
      <span class="nm-o" style="color:var(--accent);font-weight:600">名門世家 / 隱世奇門合計</span>
      <div class="bar"><i class="rare" style="width:10%"></i></div>
      <span class="v" style="color:var(--accent)">1.5%</span>
    </div>`;
  }

  function renderMemorials() {
    const grid = $('memoGrid');
    if (!grid) return;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem('jh_memorials') || '[]');
    } catch (e) {}
    const all = [...saved, ...DATA.INITIAL_MEMORIALS].slice(0, 6);
    grid.innerHTML = all.map((m, idx) => `
      <div class="memo-card">
        <div class="mh"><b>${m.name}</b><span>${m.span}</span></div>
        <div class="m-tag">${m.origin} · ${m.realm}</div>
        <q class="m-quote">${m.quote}</q>
        <div class="m-foot">
          <span>死因：${m.cause}</span>
          <button type="button" class="incense-btn" data-inc="${idx}">🕯 上香 (${m.incense || 1})</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.incense-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        btn.setAttribute('aria-pressed', 'true');
        const m = all[Number(btn.dataset.inc)];
        m.incense = (m.incense || 1) + 1;
        btn.textContent = `🕯 已上香 (${m.incense})`;
        showToast(`你為 ${m.name} 點燃了一炷清香。`);
      });
    });
  }

  function renderPastLives() {
    let past = [];
    try {
      past = JSON.parse(localStorage.getItem('jh_past_lives') || '[]');
    } catch (e) {}
    const sec = $('pastLives');
    const body = $('pastBody');
    const sum = $('pastSum');
    if (!sec || !body) return;
    if (!past.length) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    sum.textContent = `共經歷 ${past.length} 世江湖輪迴`;
    body.innerHTML = past.slice(0, 8).map((p) => `
      <li class="pl" style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--rule2)">
        <div>
          <b>${p.name}</b> <span style="color:var(--ink2);font-size:13px">（${p.sex === 'F' ? '女' : '男'} · 享年 ${p.age} 歲 · ${p.eraShort}）</span>
          <div style="font-size:12.5px;color:var(--ink3)">${p.regionName} · ${p.sect} · 武學境界：${p.realm} · 死因：${p.deathCause}</div>
        </div>
        <span class="mono" style="font-size:12px;color:var(--stamp)">${p.birthYear}–${p.birthYear + p.age}</span>
      </li>
    `).join('');
  }

  function startIntroTicker() {
    setInterval(() => {
      if (!$('intro') || $('intro').hidden) return;
      // 模擬每秒降生與離世
      if (Math.random() < 0.75) {
        introBirths += Math.floor(1 + Math.random() * 3);
        const { region } = rollRegion('birth');
        mapPulses.push({ x: region.coords[0], y: region.coords[1], r: 3, alpha: 0.9, type: 'birth' });
        $('tgFeed').textContent = `剛剛：一名嬰孩於「${region.name}」呱呱墜地（五歲以下夭折率 ${region.u5Mort}%）`;
      }
      if (Math.random() < 0.55) {
        introDeaths += Math.floor(1 + Math.random() * 2);
        const { region } = rollRegion('pop');
        mapPulses.push({ x: region.coords[0], y: region.coords[1], r: 3, alpha: 0.9, type: 'death' });
      }
      $('cBirth').textContent = introBirths.toLocaleString();
      $('cDeath').textContent = introDeaths.toLocaleString();
    }, 1100);

    // 動畫更新地圖漣漪
    function animMap() {
      if ($('intro') && !$('intro').hidden) {
        for (let i = mapPulses.length - 1; i >= 0; i--) {
          mapPulses[i].r += 0.35;
          mapPulses[i].alpha -= 0.02;
          if (mapPulses[i].alpha <= 0) mapPulses.splice(i, 1);
        }
        window.JianghuCanvas.drawJianghuMap($('tgMap'), { pulses: mapPulses });
      }
      requestAnimationFrame(animMap);
    }
    requestAnimationFrame(animMap);
  }

  // ==================== 投胎轉盤與出生戶帖 (#roll) ====================
  function startBirthRoll() {
    life = createNewLife();
    $('intro').hidden = true;
    $('dead').hidden = true;
    $('lifeview').hidden = true;
    $('roll').hidden = false;
    $('roller').hidden = false;
    $('cert').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const rollNameEl = $('rollName');
    const rollMetaEl = $('rollMeta');
    let ticks = 0;
    const maxTicks = 22;

    const timer = setInterval(() => {
      ticks++;
      const tempR = pick(DATA.REGIONS);
      rollNameEl.textContent = tempR.name;
      rollMetaEl.textContent = `${tempR.zone} · ${tempR.stratum} · 抽選機率 ${tempR.birthShare}%`;
      if (ticks >= maxTicks) {
        clearInterval(timer);
        rollNameEl.textContent = life.region.name;
        rollMetaEl.textContent = `${life.eraObj.name} · ${life.region.stratum}`;
        window.JianghuAudio.playChime('birth');
        setTimeout(showBirthCert, 650);
      }
    }, 75);
  }

  function showBirthCert() {
    $('roller').hidden = true;
    $('cert').hidden = false;

    $('certNo').textContent = `戶部魚鱗冊字號 JH-${life.birthYear}-${life.serial}`;
    $('certName').textContent = `${life.name}（${life.sex === 'F' ? '女' : '男'}）`;
    $('certStory').textContent = life.region.story;

    const le = life.sex === 'F' ? life.region.leF : life.region.leM;
    $('certFields').innerHTML = `
      <div><span class="lbl">降生疆域</span><b>${life.region.name}</b></div>
      <div><span class="lbl">門第家境</span><b>${life.familyTier}</b></div>
      <div><span class="lbl">降生紀元與時辰</span><b>${life.eraObj.short} · ${life.birthYear}年${life.shichen}</b></div>
      <div><span class="lbl">當地預期壽元</span><b>${le} 歲（五歲內夭折率 ${life.region.u5Mort}%）</b></div>
      <div><span class="lbl">家族歲入紋銀</span><b>約 ${life.annualIncome} 兩 / 年（折合米 ${Math.round(life.annualIncome * 2.2)} 石）</b></div>
      <div><span class="lbl">當地習武機緣率</span><b>${life.region.martialRate}%（代表武學：${life.region.artsPool[0]}）</b></div>
    `;

    window.JianghuCanvas.drawJianghuMap($('certMap'), {
      width: 480,
      height: 250,
      highlightId: life.region.id
    });

    $('certOdds').innerHTML = `<b>投胎統計：</b>在此刻啼哭降生的嬰孩中，抽中「<b>${life.region.name}</b>」的機率為 <b>${life.birthProb.toFixed(2)}%</b>。${
      life.region.zone === '名門世家'
        ? '你是萬中無一的天之驕子，一出生便站在江湖金字塔頂端！'
        : '如同江湖上九成以上的蒼生，你沒有顯赫家世，一切得靠雙手與機緣打拚。'
    }`;

    $('certComps').innerHTML = `
      <span class="lbl">同一時辰（${life.shichen}）在九州各處降生的另外四個嬰孩</span>
      <ul>
        ${life.peers.map((p) => `
          <li>
            <b>${p.name}（${p.sex === 'F' ? '女' : '男'}）</b>
            <span>降生於 ${p.region.name} · 預期壽元 ${p.sex === 'F' ? p.region.leF : p.region.leM} 歲</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  // ==================== 進入人生主畫面 (#lifeview) ====================
  function beginLifeSimulation() {
    $('roll').hidden = true;
    $('lifeview').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 初始 0 歲紀錄
    addFeedLog(
      0,
      `於${life.eraObj.short}（${life.birthYear}年）${life.shichen}，降生於「${life.region.name}」之${life.familyTier}人家，取名「${life.name}」。`,
      `當地出生佔比 ${life.region.birthShare}% · 5歲以下夭折率 ${life.region.u5Mort}% · 戶部清冊`,
      'ms'
    );
    life.grid.push({ age: 0, state: 'mid', badge: '生', note: `降生於${life.region.name}` });

    paused = false;
    speed = 1;
    updateSpeedUI();
    updateAllLifePanels();
    startSimLoop();
  }

  function addFeedLog(age, text, dataNote, type = '') {
    life.logs.unshift({
      id: Date.now() + Math.random(),
      age,
      year: life.birthYear + age,
      text,
      dataNote,
      type,
      starred: type === 'ms' || type === 'death'
    });
  }

  function startSimLoop() {
    clearInterval(simTimer);
    clearInterval(progTimer);
    yearProgress = 0;

    // 依據設定節奏決定 1x 下過一年所需毫秒數 (預設約 3.2 秒一年，方便流暢體驗)
    const baseYearMs = cfg.pace === 15 ? 2000 : (cfg.pace === 60 ? 4800 : 3200);

    progTimer = setInterval(() => {
      if (paused || !life || !life.alive || pendingDecision) return;
      const effSpeed = fastForwarding ? 20 : speed;
      const step = (100 / (baseYearMs / 60)) * effSpeed;
      yearProgress += step;
      if (yearProgress >= 100) {
        yearProgress = 0;
        advanceOneYear();
      }
      const progBar = $('prog');
      if (progBar) progBar.style.transform = `scaleX(${Math.min(1, yearProgress / 100)})`;
    }, 60);
  }

  // ==================== 每年推進核心邏輯 ====================
  function advanceOneYear() {
    if (!life || !life.alive) return;
    life.age += 1;
    const age = life.age;
    const r = life.region;

    // 1. 套用今年重心效果
    const foObj = DATA.FOCUSES.find((f) => f.id === life.focus) || DATA.FOCUSES[0];
    life.stats.health = clamp(life.stats.health + foObj.fx.health + (age > 45 ? -(age - 42) * 0.08 : 0));
    life.stats.mind   = clamp(life.stats.mind + foObj.fx.mind);
    // 武學成長受門第與是否有門派影響
    const martialCapMod = (life.sect.includes('白身') && r.zone !== '名門世家') ? 0.65 : 1.15;
    life.stats.martial = clamp(life.stats.martial + foObj.fx.martial * martialCapMod);
    life.stats.bonds  = clamp(life.stats.bonds + foObj.fx.bonds);

    // 2. 計算歲入與盤纏收支
    if (age >= 14) {
      const realmBonus = Math.max(0, ( life.stats.martial - 20 ) * 0.25);
      const yrInc = Math.round((r.incomeSilver * life.incomeMult * foObj.fx.silverMod + realmBonus + life.passiveIncome) * 10) / 10;
      life.annualIncome = yrInc;
      const livingCost = Math.round(yrInc * 0.68 * 10) / 10;
      life.silver = Math.max(0, Math.round((life.silver + yrInc - livingCost) * 10) / 10);
    }

    // 3. 更新同辰降生的另外 4 人狀態
    life.peers.forEach((p) => {
      if (!p.alive) return;
      if (age >= p.deathAge) {
        p.alive = false;
        p.statusText = `於 ${age} 歲離世（${p.deathCause}）†`;
        addFeedLog(age, `與你同一時辰降生於「${p.region.name}」的 ${p.name}，於今年因「${p.deathCause}」離世，得年 ${age} 歲。`, `同辰五人平行追蹤 · 當地預期壽元 ${p.sex === 'F' ? p.region.leF : p.region.leM} 歲`, 'comp');
      } else if (age === 7) {
        p.statusText = p.region.literacy > 45 ? '入私塾讀書識字' : '在鄉間幫忙農事放牧';
      } else if (age === 15) {
        p.statusText = p.art !== '無' ? `拜入「${p.sect}」，苦練${p.art}` : `以「${p.sect}」謀生營生`;
      } else if (age === 22) {
        p.statusText = Math.random() < 0.7 ? `於${p.region.name.split(' · ')[0]}成家立業` : `獨自闖蕩江湖（${p.sect}）`;
      } else if (age === 40) {
        p.statusText = p.art !== '無' ? `已成地方好手，精擅${p.art}` : '操持家業，含辛茹苦撫養兒女';
      } else if (age === 60) {
        p.statusText = '兩鬢斑白，含飴弄孫安享晚年';
      }
    });

    // 4. 父母自然離世檢查
    ['father', 'mother'].forEach((k) => {
      const par = life.family[k];
      if (par.alive && age + 24 >= par.deathAge) {
        par.alive = false;
        life.stats.mind = clamp(life.stats.mind - 8);
        addFeedLog(age, `${k === 'father' ? '父親' : '母親'}積勞病逝（享年 ${par.deathAge} 歲），你在墳前披麻戴孝，守孝三載。`, `大宋高齡雙親存世率 · 孝道禮制`, 'loss');
      }
    });

    // 5. 歷史與金庸正史大事件檢查 (◆)
    const histList = DATA.HIST_EVENTS[life.eraKey] || [];
    const histHit = histList.find((h) => h.yearOffset === age);
    if (histHit) {
      addFeedLog(age, histHit.text, histHit.stat, 'hist');
    }

    // 6. 隨機年度江湖/民生事件
    let gridBadge = '';
    let gridState = life.stats.mind >= 68 ? 'hi' : (life.stats.mind <= 38 ? 'lo' : 'mid');
    triggerYearlyRandomEvent(age, (b) => { gridBadge = b; });

    // 7. 死亡風險檢定 (依年齡、體魄、地域夭折率與兵燹仇殺率)
    const deathCheck = checkMortality(age);
    if (deathCheck.died) {
      life.alive = false;
      life.deathCause = deathCheck.cause;
      life.grid.push({ age, state: 'dead', badge: '終', note: `卒於：${deathCheck.cause}` });
      addFeedLog(age, `你在 ${age} 歲這年，因「${deathCheck.cause}」走完了這一生。`, deathCheck.statNote, 'death');
      updateAllLifePanels();
      setTimeout(triggerEndingSequence, 900);
      return;
    }

    life.grid.push({ age, state: gridState, badge: gridBadge, note: `${age}歲 · ${getRealm(life.stats.martial).name}` });

    // 8. 檢查是否變更可用重心
    ensureValidFocus();
    updateAllLifePanels();

    // 9. 檢查「駐足省思」(7, 16, 30, 50, 70歲)
    if (cfg.pauseReflect && DATA.REFLECTIONS[age] && !life.reflections[age] && !autoDecide) {
      fastForwarding = false;
      openReflectionModal(age);
      return;
    }

    // 10. 檢查重大人生抉擇 (Crossroads Decisions)
    const dec = findEligibleDecision(age);
    if (dec) {
      fastForwarding = false;
      openDecisionModal(dec);
    }
  }

  function triggerYearlyRandomEvent(age, setBadge) {
    const r = life.region;
    const roll = Math.random();

    if (age <= 5) {
      if (roll < 0.35) {
        addFeedLog(age, `在${r.name.split(' · ')[0]}的屋簷下蹒跚學步，抓著竹蜻蜓與泥人玩耍。`, `五歲以下幼童存活曲線 · 體魄 ${Math.round(life.stats.health)}`);
      } else if (roll < 0.55) {
        life.stats.health = clamp(life.stats.health - 5);
        addFeedLog(age, `入冬時染上一場風寒高熱，幸得母親徹夜熬煮薑湯照料方才退燒。`, `古代嬰幼兒冬季呼吸道染病率 34%`, 'bad');
      }
      return;
    }

    // 武學突破與習得招式
    if (life.stats.martial >= 18 && life.topArt === '無' && Math.random() < 0.45) {
      life.topArt = pick(r.artsPool);
      setBadge('武');
      addFeedLog(age, `經過日夜苦練，你終於領悟了「${life.topArt}」的精要，在同輩中嶄露頭角！`, `百曉生武學修習統計 · 當前武學 ${Math.round(life.stats.martial)}`, 'ms');
      return;
    }

    // 生子事件 (若已婚且在適育年齡)
    if (life.family.spouse && life.family.spouse.alive && age >= 20 && age <= 42 && life.family.children.length < 3 && Math.random() < 0.22) {
      const cSex = Math.random() < 0.5 ? 'F' : 'M';
      const cName = genName(r, cSex);
      life.family.children.push({ name: cName, sex: cSex, birthAge: age });
      life.stats.mind = clamp(life.stats.mind + 8);
      life.stats.bonds = clamp(life.stats.bonds + 8);
      setBadge('子');
      addFeedLog(age, `家中添丁之喜！伴侶為你誕下一${cSex === 'F' ? '女' : '子'}，取名「${cName}」。`, `大宋戶部生育率統計 · 家庭羈絆提昇`, 'ms');
      return;
    }

    // 一般年度事件池
    if (roll < 0.16) {
      // 豐年或收穫
      const bonus = Math.round(r.incomeSilver * 0.4 * 10) / 10;
      life.silver = Math.round((life.silver + bonus) * 10) / 10;
      life.stats.mind = clamp(life.stats.mind + 4);
      addFeedLog(age, `今年風調雨順，市集買賣興隆，手頭多攢下了 ${bonus} 兩紋銀。`, `各地農業與商業景氣波動 · 歲入穩定`);
    } else if (roll < 0.30) {
      // 災荒或疾病
      life.stats.health = clamp(life.stats.health - 6);
      life.silver = Math.max(0, Math.round((life.silver - 2) * 10) / 10);
      addFeedLog(age, `夏秋之交疫癘與旱情蔓延，只得節衣縮食、抓藥調理身體。`, `地方州縣災荒發生率 ${Math.round(r.warRisk * 0.8)}%`, 'bad');
    } else if (roll < 0.44 && (life.focus === 'outer' || life.focus === 'inner' || life.stats.martial >= 25)) {
      // 江湖切磋
      life.stats.martial = clamp(life.stats.martial + 3.5);
      addFeedLog(age, `於渡口茶肆偶遇一名遊方武師，雙方點到為止切磋數招，對「${life.topArt !== '無' ? life.topArt : r.artsPool[0]}」頗有進益。`, `江湖同道切磋勝率 · 武學 ${Math.round(life.stats.martial)}`);
    } else if (roll < 0.56) {
      // 歲月靜好
      life.stats.bonds = clamp(life.stats.bonds + 3);
      addFeedLog(age, `中秋月圓之夜，與親友鄰里分食月餅、聽老輩講述早年五絕與大俠的傳說。`, `常年生活滿意度指數 · 心境 ${Math.round(life.stats.mind)}`);
    }
  }

  // 死亡率檢定 (結合真實古代生命表與江湖風險)
  function checkMortality(age) {
    const r = life.region;
    const le = life.sex === 'F' ? r.leF : r.leM;

    // 1. 5歲以下嬰幼兒夭折檢定
    if (age <= 5) {
      const yearlyU5Prob = (r.u5Mort / 100) / 5.2;
      if (Math.random() < yearlyU5Prob * (life.stats.health < 50 ? 1.3 : 0.85)) {
        return {
          died: true,
          cause: age <= 1 ? '襁褓驚風與先天不足早夭' : '幼年高熱疫病與飢寒早夭',
          statNote: `${r.name} 5歲以下兒童死亡率 ${r.u5Mort}% · 戶部與WHO歷史生命表模型`
        };
      }
    }

    // 2. 體魄歸零死亡
    if (life.stats.health <= 2) {
      return {
        died: true,
        cause: '氣血枯竭與沉痾宿疾併發而亡',
        statNote: `體魄降至臨界值 · 醫療匱乏環境致死率 92%`
      };
    }

    // 3. 戰亂與江湖仇殺檢定
    const hazardBase = (r.warRisk * life.eraObj.warMod + (life.focus === 'chivalry' ? r.feudRisk * 1.4 : r.feudRisk * 0.5)) / 2200;
    if (age >= 15 && Math.random() < hazardBase) {
      // 若武學高強可大幅化解死劫
      if (life.stats.martial >= 60 && Math.random() < 0.72) {
        life.stats.health = clamp(life.stats.health - 12);
        addFeedLog(age, `遭逢強敵與兵禍伏擊，幸賴一身深厚武學（${life.topArt}）浴血殺出重圍，僅受皮肉之傷！`, `高階武學化險為夷機率 72%`, 'ms');
      } else {
        const c = pick(r.causes);
        return {
          died: true,
          cause: c,
          statNote: `${r.name} 兵燹與江湖死傷統計 · 年化風險 ${(hazardBase * 100).toFixed(1)}%`
        };
      }
    }

    // 4. 自然衰老生命表檢定
    if (age > 28) {
      const ageRatio = (age - le) / 14;
      const healthMod = (100 - life.stats.health) / 65;
      const gompertzProb = 0.008 * Math.exp(ageRatio * 1.65) * (0.6 + healthMod);
      if (Math.random() < gompertzProb) {
        return {
          died: true,
          cause: age >= le ? '壽終正寢，於榻上安詳瞑目' : pick(r.causes),
          statNote: `${r.name} 分性別生命表（預期壽元 ${le} 歲）· 享年 ${age} 歲`
        };
      }
    }

    return { died: false };
  }

  // ==================== 重大抉擇與駐足省思視窗 ====================
  function findEligibleDecision(age) {
    for (const d of DATA.DECISIONS) {
      if (life.usedDecisions[d.id]) continue;
      if (age >= d.minAge && age <= d.maxAge) {
        if (Math.random() < 0.48 || age === d.maxAge) {
          return d;
        }
      }
    }
    return null;
  }

  function openDecisionModal(dec) {
    pendingDecision = dec;
    life.usedDecisions[dec.id] = true;
    window.JianghuAudio.playChime('decision');

    // 若開啟自動抉擇，直接替玩家選擇並紀錄
    if (autoDecide) {
      const idx = Math.floor(Math.random() * dec.choices.length);
      applyDecisionChoice(dec, dec.choices[idx]);
      return;
    }

    const modal = $('modal');
    modal.hidden = false;
    $('decPeek').hidden = true;

    modal.innerHTML = `
      <div class="dec" role="dialog" aria-modal="true">
        <div class="hd">
          <span>江湖十字路口 · ${life.age} 歲（${life.birthYear + life.age}年）</span>
          <span>
            <button type="button" class="decmin" id="decMinBtn">先看看四周</button>
          </span>
        </div>
        <div class="bd">
          <h2>${dec.title}</h2>
          <p>${dec.desc}</p>
          <div class="fact">資料 ${dec.fact}</div>
          <div class="ch">
            ${dec.choices.map((c, i) => `
              <button type="button" data-cidx="${i}">
                <span class="k">${i + 1}</span>
                <b>${c.label}</b>
                <small>${c.sub}</small>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    $('decMinBtn').addEventListener('click', () => {
      modal.hidden = true;
      $('decPeek').hidden = false;
      $('decPeekT').textContent = dec.title;
    });

    modal.querySelectorAll('.ch button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = dec.choices[Number(btn.dataset.cidx)];
        applyDecisionChoice(dec, ch);
      });
    });
  }

  function applyDecisionChoice(dec, ch) {
    const fx = ch.fx || {};
    if (fx.health)  life.stats.health  = clamp(life.stats.health + fx.health);
    if (fx.mind)    life.stats.mind    = clamp(life.stats.mind + fx.mind);
    if (fx.martial) life.stats.martial = clamp(life.stats.martial + fx.martial);
    if (fx.bonds)   life.stats.bonds   = clamp(life.stats.bonds + fx.bonds);
    if (fx.silver)  life.silver        = Math.max(0, Math.round((life.silver + fx.silver) * 10) / 10);

    let extraNote = '';
    if (fx.joinSect) {
      life.sect = pick(life.region.sectPool);
      life.topArt = pick(life.region.artsPool);
      life.family.master = { name: pick(DATA.SURNAMES) + '師父', alive: true };
      extraNote = `（正式拜入「${life.sect}」，獲傳「${life.topArt}」）`;
    }
    if (fx.gambleManual) {
      if (Math.random() < 0.68 || life.stats.martial >= 30) {
        life.stats.martial = clamp(life.stats.martial + 22);
        life.topArt = pick(life.region.artsPool);
        extraNote = `（奇遇大成！贯通任督二脈，武學暴漲 +22！）`;
      } else {
        life.stats.health = clamp(life.stats.health - 18);
        life.stats.martial = clamp(life.stats.martial + 6);
        extraNote = `（真氣逆行嘔血，體魄受創 -18，幸保住性命）`;
      }
    }
    if (fx.marry) {
      const spSex = life.sex === 'F' ? 'M' : 'F';
      const spName = genName(life.region, spSex);
      life.family.spouse = {
        name: spName,
        type: fx.marry === 'jianghu' ? '江湖俠侶' : '結髮伴侶',
        alive: true
      };
      if (life.grid.length) life.grid[life.grid.length - 1].badge = '婚';
      extraNote = `（與「${spName}」結為${life.family.spouse.type}）`;
    }
    if (fx.fightInjustice) {
      if (life.stats.martial >= 28 || Math.random() < 0.55) {
        life.stats.martial = clamp(life.stats.martial + 10);
        life.stats.bonds = clamp(life.stats.bonds + 16);
        life.stats.mind = clamp(life.stats.mind + 12);
        extraNote = `（三拳兩腳擊退惡徒，滿樓喝采，俠名遠播！）`;
      } else {
        life.stats.health = clamp(life.stats.health - 20);
        life.stats.bonds = clamp(life.stats.bonds + 10);
        extraNote = `（寡不敵眾身負刀傷 -20，幸得路過義士接應脫險）`;
      }
    }
    if (fx.warDefend || fx.grandBattle) {
      if (life.stats.martial >= 45 || Math.random() < 0.72) {
        life.stats.martial = clamp(life.stats.martial + 15);
        life.stats.bonds = clamp(life.stats.bonds + 20);
        life.stats.mind = clamp(life.stats.mind + 14);
        if (life.grid.length) life.grid[life.grid.length - 1].badge = '俠';
        extraNote = `（於萬軍之中全身而退，威震江湖！）`;
      } else {
        life.stats.health = clamp(life.stats.health - 26);
        life.stats.bonds = clamp(life.stats.bonds + 15);
        extraNote = `（血戰中身受重創 -26，死裡逃生）`;
      }
    }

    addFeedLog(
      life.age,
      `【抉擇 · ${dec.title}】你選擇了「${ch.label}」——${ch.log}${extraNote}`,
      dec.fact,
      'dec'
    );

    pendingDecision = null;
    $('modal').hidden = true;
    $('decPeek').hidden = true;
    updateAllLifePanels();
  }

  // 駐足省思視窗
  function openReflectionModal(age) {
    const ref = DATA.REFLECTIONS[age];
    if (!ref) return;
    pendingDecision = { type: 'reflection', age };
    const modal = $('modal');
    modal.hidden = false;

    modal.innerHTML = `
      <div class="dec pause" role="dialog" aria-modal="true">
        <div class="hd">
          <span>✎ 駐足片刻 · ${ref.title}</span>
          <span>時間已為你暫停</span>
        </div>
        <div class="bd">
          <h2>在 ${life.name} 的 ${age} 歲，停下來想一想</h2>
          <p class="q" style="font-family:var(--f-display);font-size:18px;color:var(--ink)">${ref.q}</p>
          <textarea id="refInput" rows="3" placeholder="留下一行字給自己或這個角色（選填，會收錄進最終的命終卷宗）..."></textarea>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="ghost sm" id="refSkipBtn">略過，繼續前行</button>
            <button type="button" class="cta sm" id="refSaveBtn">記下想法，繼續人生</button>
          </div>
        </div>
      </div>
    `;

    const closeRef = (saveText) => {
      const val = (saveText ? $('refInput').value.trim() : '');
      life.reflections[age] = val || '（靜默駐足，未留字句）';
      if (val) {
        addFeedLog(age, `【駐足手札】「${val}」`, `${ref.title} · 玩家省思紀錄`, 'note');
      }
      pendingDecision = null;
      modal.hidden = true;
      updateAllLifePanels();
    };

    $('refSkipBtn').addEventListener('click', () => closeRef(false));
    $('refSaveBtn').addEventListener('click', () => closeRef(true));
  }

  // 銀兩 · 置產與修煉視窗 (#goShop)
  function openShopModal() {
    if (!life || !life.alive) return;
    const wasPaused = paused;
    paused = true;
    updateSpeedUI();

    const modal = $('modal');
    modal.hidden = false;

    function renderShopContent() {
      modal.innerHTML = `
        <div class="dec" role="dialog" aria-modal="true">
          <div class="hd">
            <span>銀兩 · 置產與修煉</span>
            <span>目前盤纏積蓄：<b>${life.silver.toFixed(1)} 兩紋銀</b></span>
          </div>
          <div class="bd">
            <h2>行囊置辦與靈丹秘笈</h2>
            <p style="font-size:13.5px">在江湖中，銀兩雖買不到天命，卻能添置良田、延醫買藥或購置兵刃防身。</p>
            <div class="ch">
              ${DATA.SHOP_ITEMS.map((it, idx) => {
                const canBuy = life.silver >= it.cost;
                return `
                  <button type="button" class="${canBuy ? '' : 'lock'}" data-sidx="${idx}" ${canBuy ? '' : 'disabled'}>
                    <span class="k">${it.cost}兩</span>
                    <b>${it.name}</b>
                    <small>${it.desc}</small>
                  </button>
                `;
              }).join('')}
            </div>
            <div style="margin-top:16px;text-align:right">
              <button type="button" class="ghost sm" id="shopCloseBtn">返回江湖</button>
            </div>
          </div>
        </div>
      `;

      $('shopCloseBtn').addEventListener('click', () => {
        modal.hidden = true;
        paused = wasPaused;
        updateSpeedUI();
      });

      modal.querySelectorAll('.ch button:not(.lock)').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = DATA.SHOP_ITEMS[Number(btn.dataset.sidx)];
          if (life.silver < item.cost) return;
          life.silver = Math.round((life.silver - item.cost) * 10) / 10;
          if (item.fx.health)  life.stats.health  = clamp(life.stats.health + item.fx.health);
          if (item.fx.mind)    life.stats.mind    = clamp(life.stats.mind + item.fx.mind);
          if (item.fx.martial) life.stats.martial = clamp(life.stats.martial + item.fx.martial);
          if (item.fx.bonds)   life.stats.bonds   = clamp(life.stats.bonds + item.fx.bonds);
          if (item.fx.passiveIncome) life.passiveIncome += item.fx.passiveIncome;
          if (item.equip) life.weapon = item.equip;

          addFeedLog(life.age, `耗銀 ${item.cost} 兩購置了「${item.name}」（${item.desc}）。`, `商號交易紀錄 · 餘銀 ${life.silver.toFixed(1)} 兩`, 'ms');
          showToast(`已置辦：${item.name}`);
          updateAllLifePanels();
          renderShopContent();
        });
      });
    }

    renderShopContent();
  }

  // ==================== 更新主畫面所有儀表板 ====================
  function ensureValidFocus() {
    const cur = DATA.FOCUSES.find((f) => f.id === life.focus);
    if (!cur || life.age < cur.minAge || life.age > cur.maxAge || (cur.reqMartial && life.stats.martial < cur.reqMartial)) {
      life.focus = life.age < 12 ? 'survive' : 'labor';
    }
  }

  function updateAllLifePanels() {
    if (!life) return;
    const r = life.region;
    const realm = getRealm(life.stats.martial);

    // Topbar
    $('ageNum').innerHTML = `${life.age}<small>歲</small>`;
    const stageStr = life.age <= 5 ? '襁褓稚齡' : (life.age <= 14 ? '垂髫少年' : (life.age <= 29 ? '弱冠青年' : (life.age <= 49 ? '壯年江湖' : '暮年滄桑')));
    $('ageYear').textContent = `${life.eraObj.short} · ${life.birthYear + life.age}年 · ${stageStr}`;

    // ID Card
    $('idTop').innerHTML = `<span>官府戶帖 · 江湖身契</span><span>NO.${life.serial}</span>`;
    window.JianghuCanvas.drawPortrait($('portrait'), life);
    $('idName').innerHTML = `<span>${life.name}</span><span class="realm-pill">${realm.name}</span>`;
    $('idDl').innerHTML = `
      <dt>性別/生辰</dt><dd>${life.sex === 'F' ? '女' : '男'} · ${life.birthYear}年${life.shichen}</dd>
      <dt>籍貫門第</dt><dd>${r.name}</dd>
      <dt>門派/營生</dt><dd>${life.sect}</dd>
      <dt>修習武學</dt><dd>${life.topArt}</dd>
      <dt>隨身兵刃</dt><dd>${life.weapon}</dd>
    `;
    $('mrz').innerHTML = buildMRZ(life);

    // 4 Stat Bars
    const stDefs = [
      { key: 'health',  label: '體魄', color: 'var(--good)' },
      { key: 'mind',    label: '心境', color: 'var(--gold)' },
      { key: 'martial', label: '武學', color: 'var(--accent)' },
      { key: 'bonds',   label: '情義', color: 'var(--stamp)' }
    ];
    $('statBars').innerHTML = stDefs.map((s) => {
      const val = Math.round(life.stats[s.key]);
      return `<div class="stat">
        <span>${s.label}</span>
        <div class="bar"><i style="width:${val}%;background:${s.color}"></i></div>
        <span class="v">${val}</span>
      </div>`;
    }).join('');

    // Money & Spend
    const pppNTD = Math.round(life.annualIncome * 18500).toLocaleString();
    $('money').innerHTML = `
      <div>
        <span class="lbl">歲入紋銀</span>
        <b>${life.annualIncome.toFixed(1)} 兩 / 年</b>
        <small>約折合現代購買力 NT$ ${pppNTD}</small>
      </div>
      <div>
        <span class="lbl">行囊積蓄盤纏</span>
        <b>${life.silver.toFixed(1)} 兩</b>
        <small>折合白米約 ${Math.round(life.silver * 2.2)} 石</small>
      </div>
    `;
    $('spend').innerHTML = `
      <div class="sbar">
        <i style="width:48%;background:#9C7020"></i>
        <i style="width:22%;background:#0F6E68"></i>
        <i style="width:18%;background:#8C1D3C"></i>
        <i style="width:12%;background:#627276"></i>
      </div>
      <div class="keys">
        <span style="--c:#9C7020">五穀伙食 48%</span>
        <span style="--c:#0F6E68">湯藥調理 22%</span>
        <span style="--c:#8C1D3C">兵刃修練 18%</span>
        <span style="--c:#627276">人情香油 12%</span>
      </div>
    `;

    // Family & Sect Bonds
    const famRows = [
      { role: '父親', val: life.family.father.name, alive: life.family.father.alive },
      { role: '母親', val: life.family.mother.name, alive: life.family.mother.alive }
    ];
    if (life.family.master) {
      famRows.push({ role: '授業恩師', val: `${life.family.master.name}（${life.sect}）`, alive: life.family.master.alive });
    }
    if (life.family.spouse) {
      famRows.push({ role: life.family.spouse.type, val: life.family.spouse.name, alive: life.family.spouse.alive });
    } else if (life.age >= 18) {
      famRows.push({ role: '婚姻伴侶', val: '孤身未娶/未嫁', alive: true });
    }
    life.family.children.forEach((c, idx) => {
      famRows.push({ role: `子嗣 (${idx + 1})`, val: `${c.name}（${life.age - c.birthAge}歲）`, alive: true });
    });
    $('fam').innerHTML = famRows.map((row) => `
      <div class="row">
        <span>${row.role}</span>
        <span class="${row.alive ? '' : 'gone'}">${row.val}${row.alive ? '' : ' (已故)'}</span>
      </div>
    `).join('');

    // Scene & Caption
    window.JianghuCanvas.drawScene($('scene'), life);
    const foNow = DATA.FOCUSES.find((f) => f.id === life.focus) || DATA.FOCUSES[0];
    $('sceneCap').textContent = `【${r.name}】${life.age}歲的${life.name}（${realm.name}），今年正以「${foNow.name}」為生活重心。`;

    // Focus Chips
    $('status').innerHTML = `現居 <b>${r.name}</b> · 身分：<b>${life.sect}</b> · 境界：<b>${realm.name}</b>（${realm.desc}）`;
    const availFocuses = DATA.FOCUSES.filter((f) => life.age >= f.minAge && life.age <= f.maxAge && (!f.reqMartial || life.stats.martial >= f.reqMartial));
    $('focusChips').innerHTML = availFocuses.map((f) => `
      <button type="button" class="chip" data-foid="${f.id}" aria-pressed="${life.focus === f.id}">
        <b>${f.name}</b>
        <small>${f.sub}</small>
      </button>
    `).join('');
    $('focusChips').querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        life.focus = btn.dataset.foid;
        updateAllLifePanels();
      });
    });

    // Feed List
    $('feed').innerHTML = life.logs.slice(0, 60).map((item) => `
      <li class="${item.type} ${item.starred ? 'starred' : ''}" data-logid="${item.id}">
        <span class="a">${item.age}歲</span>
        <div class="x">
          ${item.text}
          ${item.dataNote ? `<span class="f">${item.dataNote}</span>` : ''}
        </div>
      </li>
    `).join('');
    $('feed').querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        const logObj = life.logs.find((l) => String(l.id) === li.dataset.logid);
        if (logObj) {
          logObj.starred = !logObj.starred;
          li.classList.toggle('starred', logObj.starred);
        }
      });
    });

    // Right Column: 4 Peers
    $('compList').innerHTML = life.peers.map((p) => `
      <li class="${p.alive ? '' : 'gone'}">
        <div class="cn">
          <b>${p.name}（${p.sex === 'F' ? '女' : '男'}）</b>
          <small>${p.region.name} · ${p.sect}</small>
        </div>
        <div class="cs">${p.statusText}</div>
      </li>
    `).join('');

    // Right Column: 10x10 Life Map Grid
    const leAge = Math.round(life.sex === 'F' ? r.leF : r.leM);
    let cellsHTML = '';
    for (let i = 0; i < 90; i++) {
      const g = life.grid[i];
      const isCur = i === life.age && life.alive;
      const isLe = i === leAge;
      let bg = 'var(--rule2)';
      let badge = '';
      let cls = 'c';
      if (isCur) cls += ' cur';
      if (isLe) cls += ' le';
      if (g) {
        if (g.state === 'dead') {
          cls += ' dead';
          badge = '終';
        } else {
          bg = g.state === 'hi' ? 'var(--grid-hi)' : (g.state === 'lo' ? 'var(--grid-lo)' : 'var(--grid-mid)');
          badge = g.badge || '';
        }
      }
      cellsHTML += `<div class="${cls}" style="background:${bg}" title="${g ? g.note : `第 ${i} 歲${isLe ? '（當地平均壽元）' : ''}`}">${badge}</div>`;
    }
    $('grid').innerHTML = cellsHTML;

    // Right Column: Survival Curve SVG
    renderSurvivalChart();

    // Right Column: Region Statistical Dossier
    $('ctyTitle').textContent = `${r.name} · 統計卷宗`;
    $('ctyDl').innerHTML = `
      <dt>所屬疆域階層</dt><dd>${r.zone} · ${r.stratum}</dd>
      <dt>占江湖出生人口比例</dt><dd>${r.birthShare}%</dd>
      <dt>平均預期壽元（男 / 女）</dt><dd>${r.leM} 歲 / ${r.leF} 歲</dd>
      <dt>5歲以下夭折率</dt><dd>${r.u5Mort}%</dd>
      <dt>人均歲入紋銀（PPP換算）</dt><dd>${r.incomeSilver} 兩 (約 NT$${Math.round(r.incomeSilver * 18500).toLocaleString()})</dd>
      <dt>貧富吉尼係數</dt><dd>${r.gini}</dd>
      <dt>讀書識字率</dt><dd>${r.literacy}%</dd>
      <dt>接觸武學比例</dt><dd>${r.martialRate}%</dd>
      <dt>兵燹戰亂與仇殺風險</dt><dd>${r.warRisk}% / ${r.feudRisk}%</dd>
      <dt>代表門派與武學</dt><dd>${r.sectPool[0]} · ${r.artsPool[0]}</dd>
    `;
  }

  function renderSurvivalChart() {
    const r = life.region;
    const w = 300;
    const h = 135;
    const padL = 28;
    const padR = 10;
    const padT = 10;
    const padB = 22;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    const ptsRegion = [];
    const ptsAvg = [];
    const avgRegion = DATA.REGIONS[3]; // 齊魯平均基準
    for (let a = 0; a <= 85; a += 5) {
      const x = padL + (a / 85) * pw;
      const yR = padT + (1 - calcSurvivalRate(r, life.sex, a) / 100) * ph;
      const yA = padT + (1 - calcSurvivalRate(avgRegion, life.sex, a) / 100) * ph;
      ptsRegion.push(`${x.toFixed(1)},${yR.toFixed(1)}`);
      ptsAvg.push(`${x.toFixed(1)},${yA.toFixed(1)}`);
    }

    const curAge = Math.min(85, life.age);
    const curX = padL + (curAge / 85) * pw;
    const curSurv = calcSurvivalRate(r, life.sex, curAge);
    const curY = padT + (1 - curSurv / 100) * ph;

    $('chart').innerHTML = `
      <svg viewBox="0 0 ${w} ${h}">
        <line x1="${padL}" y1="${padT + ph}" x2="${w - padR}" y2="${padT + ph}" stroke="var(--rule)" stroke-width="1"/>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + ph}" stroke="var(--rule)" stroke-width="1"/>
        <text x="${padL - 4}" y="${padT + 8}" font-size="9" fill="var(--ink3)" text-anchor="end">100%</text>
        <text x="${padL - 4}" y="${padT + ph}" font-size="9" fill="var(--ink3)" text-anchor="end">0%</text>
        <text x="${padL}" y="${h - 4}" font-size="9" fill="var(--ink3)">0歲</text>
        <text x="${padL + pw * 0.5}" y="${h - 4}" font-size="9" fill="var(--ink3)" text-anchor="middle">42歲</text>
        <text x="${w - padR}" y="${h - 4}" font-size="9" fill="var(--ink3)" text-anchor="end">85歲</text>
        <polyline fill="none" stroke="var(--ink3)" stroke-width="1.4" stroke-dasharray="3 3" points="${ptsAvg.join(' ')}"/>
        <polyline fill="none" stroke="var(--stamp)" stroke-width="2.2" points="${ptsRegion.join(' ')}"/>
        <circle cx="${curX}" cy="${curY}" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>
        <text x="${Math.min(w - 42, curX + 6)}" y="${Math.max(16, curY - 5)}" font-size="10" font-family="var(--f-mono)" fill="var(--accent)" font-weight="bold">${life.age}歲 (${curSurv}%)</text>
      </svg>
    `;
  }

  // ==================== 謝世走馬燈劇場 (.ending) 與 命終卷宗 (#dead) ====================
  function triggerEndingSequence() {
    clearInterval(progTimer);
    // 儲存前世紀錄
    savePastLifeRecord();

    const highlights = life.logs.filter((l) => l.starred || l.type === 'ms' || l.type === 'dec' || l.type === 'death').slice().reverse();
    const slides = highlights.length ? highlights.slice(0, 6) : life.logs.slice(0, 4).reverse();

    const endingEl = $('endingOverlay');
    endingEl.hidden = false;
    let idx = 0;

    function renderSlide(i) {
      const s = slides[i];
      $('endAge').textContent = `${s.year}年 · ${s.age} 歲`;
      $('endText').textContent = s.text;
      window.JianghuCanvas.drawScene($('endPic'), {
        region: life.region,
        age: s.age,
        sex: life.sex,
        focus: life.focus,
        stats: life.stats,
        spouse: life.family.spouse
      });
      $('endStrip').innerHTML = slides.map((_, k) => `<span class="${k <= i ? 'lit' : ''}"></span>`).join('');
    }

    renderSlide(0);
    const slideTimer = setInterval(() => {
      idx++;
      if (idx >= slides.length) {
        clearInterval(slideTimer);
        closeEndingShowDeathCert();
      } else {
        renderSlide(idx);
      }
    }, 2400);

    $('endSkipBtn').onclick = () => {
      clearInterval(slideTimer);
      closeEndingShowDeathCert();
    };
  }

  function closeEndingShowDeathCert() {
    $('endingOverlay').hidden = true;
    $('lifeview').hidden = true;
    $('dead').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const r = life.region;
    const realm = getRealm(life.stats.martial);
    const homeObj = DATA.REAL_HOMES.find((h) => h.id === cfg.home) || DATA.REAL_HOMES[0];
    const survAtDeath = calcSurvivalRate(r, life.sex, life.age);

    // 結算所有同辰同伴至最終結局
    const all5 = [
      {
        isMe: true,
        name: life.name,
        sex: life.sex,
        age: life.age,
        regionName: r.name,
        sect: `${life.sect} · ${realm.name}`,
        cause: life.deathCause
      },
      ...life.peers.map((p) => ({
        isMe: false,
        name: p.name,
        sex: p.sex,
        age: p.deathAge,
        regionName: p.region.name,
        sect: `${p.sect}${p.art !== '無' ? `（${p.art}）` : ''}`,
        cause: p.deathCause
      }))
    ];

    const refEntries = Object.entries(life.reflections);

    $('dead').innerHTML = `
      <div class="dcert">
        <div class="band">
          <span>江湖命終卷宗 · 戶部與百曉生合纂</span>
          <span>卷宗字號 JH-END-${life.birthYear + life.age}-${life.serial}</span>
        </div>
        <div class="body">
          <div>
            <div class="span">${life.eraObj.name} · ${life.birthYear}年 — ${life.birthYear + life.age}年（享年 ${life.age} 歲）</div>
            <h1>${life.name} <small style="font-size:.48em;color:var(--stamp)">〔${realm.name}〕</small></h1>
            <div class="cause">命終死因：<b>${life.deathCause}</b></div>
            <p class="story">
              ${life.name}生於「${r.name}」之${life.familyTier}。一生歷經 ${life.age} 載寒暑，最終身分為「<b>${life.sect}</b>」，武學止步於「<b>${realm.name}</b>」（所習代表技藝：${life.topArt}）。
              在同一年於當地降生的嬰孩中，僅有 <b>${survAtDeath}%</b> 能活到這個歲數。
            </p>
            <div class="farewell">
              <label class="lbl" for="fwInput" style="display:block;margin-bottom:6px">為這段江湖人生留下一句墓誌銘（可安放至首頁江湖追思祠）</label>
              <div class="fwrow">
                <textarea id="fwInput" rows="2" placeholder="寫下墓誌銘，例如：仗劍行千里，歸來仍是黃河岸邊的少年..."></textarea>
                <button type="button" class="cta" id="saveMemoBtn">安放追思祠</button>
              </div>
            </div>
          </div>
          <div class="summary">
            <div><span class="lbl">降生疆域與門第</span><b>${r.name}</b><small>抽中機率 ${life.birthProb.toFixed(2)}% · ${r.stratum}</small></div>
            <div><span class="lbl">最終武學境界</span><b>${realm.name}（武學 ${Math.round(life.stats.martial)}）</b><small>${realm.desc}</small></div>
            <div><span class="lbl">畢生最高隨身武技</span><b>${life.topArt}</b><small>兵刃：${life.weapon}</small></div>
            <div><span class="lbl">終老行囊遺產</span><b>紋銀 ${life.silver.toFixed(1)} 兩</b><small>歲入約 ${life.annualIncome.toFixed(1)} 兩 / 年</small></div>
            <div class="wide"><span class="lbl">家眷與紅塵羈絆</span><b>${
              life.family.spouse ? `伴侶：${life.family.spouse.name}（育有 ${life.family.children.length} 名子嗣）` : '終生未婚，孤身一人行路'
            }</b><small>最終情義值：${Math.round(life.stats.bonds)} / 100 · 心境值：${Math.round(life.stats.mind)} / 100</small></div>
          </div>
        </div>
        <figure class="lifemap">
          <canvas id="deadMapCanvas" width="600" height="260"></canvas>
          <figcaption><b>生平九州足跡輿圖</b>：降生並終老於「${r.name}」（紅圈標示處）</figcaption>
        </figure>
      </div>

      <div class="after">
        <div class="panel">
          <h3><span>同一時辰（${life.shichen}）降生的五人最終命途</span><span class="lbl">平行人生對照</span></h3>
          <ul class="lives5">
            ${all5.map((p) => `
              <li class="${p.isMe ? 'me' : ''}">
                <div class="ca">${p.age}<small style="font-size:13px">歲</small></div>
                <div>
                  <b>${p.name}（${p.sex === 'F' ? '女' : '男'}${p.isMe ? ' · 你' : ''}）— ${p.regionName}</b>
                  <p>身分：${p.sect}<br>結局：${p.cause}</p>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="panel homecmp">
          <h3><span>跨時空統計對照</span><span class="lbl">這具江湖肉身 vs ${homeObj.name}</span></h3>
          <table>
            <thead>
              <tr><th>統計指標</th><th>此世（${r.name}）</th><th>${homeObj.name}</th></tr>
            </thead>
            <tbody>
              <tr><td>平均預期壽命</td><td>${life.sex === 'F' ? r.leF : r.leM} 歲（你活了 ${life.age} 歲）</td><td>${homeObj.le} 歲</td></tr>
              <tr><td>5歲以下夭折率</td><td>${r.u5Mort}%</td><td>${homeObj.u5}%</td></tr>
              <tr><td>識字與受教普及率</td><td>${r.literacy}%</td><td>${homeObj.literacy}%</td></tr>
              <tr><td>年均購買力所得</td><td>紋銀 ${life.annualIncome.toFixed(1)} 兩 (約 NT$${Math.round(life.annualIncome * 18500).toLocaleString()})</td><td>PPP US$${homeObj.incomeUSD.toLocaleString()}</td></tr>
              <tr><td>兵燹/暴力致死風險</td><td>年化 ${(r.warRisk * 0.4).toFixed(1)}%</td><td>每十萬人 ${homeObj.homicide} 人</td></tr>
            </tbody>
          </table>
          ${refEntries.length ? `
            <div style="margin-top:18px;border-top:1px dashed var(--rule);padding-top:12px">
              <span class="lbl">你在這一生留下的駐足省思</span>
              <ul class="journal">
                ${refEntries.map(([k, v]) => `<li><small>${k} 歲時</small><q>${v}</q></li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="endbtns">
        <button type="button" class="cta" id="rebirthBtn">再入輪迴（重新投胎）</button>
        <button type="button" class="ghost" id="shareDeadCardBtn">下載命終卷宗分享圖卡</button>
        <button type="button" class="ghost" id="backIntroBtn">返回首頁與追思祠</button>
      </div>
    `;

    window.JianghuCanvas.drawJianghuMap($('deadMapCanvas'), {
      width: 600,
      height: 260,
      highlightId: r.id,
      trail: life.trail
    });

    $('saveMemoBtn').addEventListener('click', () => {
      const q = $('fwInput').value.trim() || `生於${r.name}，行過一場無悔江湖。`;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem('jh_memorials') || '[]');
      } catch (e) {}
      saved.unshift({
        name: life.name,
        span: `${life.birthYear}–${life.birthYear + life.age} · 享年${life.age}歲`,
        origin: r.name,
        realm: `${ getRealm(life.stats.martial).name } · ${life.sect}`,
        cause: life.deathCause,
        quote: q,
        incense: 1
      });
      localStorage.setItem('jh_memorials', JSON.stringify(saved.slice(0, 20)));
      $('saveMemoBtn').disabled = true;
      $('saveMemoBtn').textContent = '已安放於追思祠';
      showToast('已將此生墓誌銘安放至首頁「江湖追思祠」！');
    });

    $('rebirthBtn').addEventListener('click', startBirthRoll);
    $('backIntroBtn').addEventListener('click', () => {
      $('dead').hidden = true;
      $('intro').hidden = false;
      renderMemorials();
      renderPastLives();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    $('shareDeadCardBtn').addEventListener('click', () => exportShareCard(true));
  }

  function savePastLifeRecord() {
    if (!life) return;
    let past = [];
    try {
      past = JSON.parse(localStorage.getItem('jh_past_lives') || '[]');
    } catch (e) {}
    past.unshift({
      name: life.name,
      sex: life.sex,
      age: life.age,
      birthYear: life.birthYear,
      eraShort: life.eraObj.short,
      regionName: life.region.name,
      sect: life.sect,
      realm: getRealm(life.stats.martial).name,
      deathCause: life.deathCause
    });
    localStorage.setItem('jh_past_lives', JSON.stringify(past.slice(0, 30)));
  }

  // 匯出出生戶帖或命終分享圖卡 (Canvas 繪製下載 PNG)
  function exportShareCard(isDead = false) {
    if (!life) return;
    const cv = document.createElement('canvas');
    cv.width = 720;
    cv.height = 420;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#F8FAF7';
    ctx.fillRect(0, 0, 720, 420);
    ctx.fillStyle = isDead ? '#282B36' : '#8C1D3C';
    ctx.fillRect(0, 0, 720, 54);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Noto Serif TC", serif';
    ctx.fillText(isDead ? '《八千萬分之1 · 江湖命終卷宗》' : '《八千萬分之1 · 官府出生戶帖》', 24, 34);
    ctx.font = '13px monospace';
    ctx.fillText(`1in80m-jianghu · NO.${life.serial}`, 510, 34);

    ctx.fillStyle = '#142026';
    ctx.font = 'bold 36px "Noto Serif TC", serif';
    const title = isDead
      ? `${life.name}（享年 ${life.age} 歲 · ${getRealm(life.stats.martial).name}）`
      : `${life.name}（降生於 ${life.region.name}）`;
    ctx.fillText(title, 28, 112);

    ctx.fillStyle = '#0F6E68';
    ctx.font = 'bold 16px "Noto Sans TC", sans-serif';
    ctx.fillText(`${life.eraObj.name} · 出身門第：${life.familyTier}（抽選機率 ${life.birthProb.toFixed(2)}%）`, 28, 148);

    ctx.fillStyle = '#48585E';
    ctx.font = '16px "Noto Sans TC", sans-serif';
    if (isDead) {
      ctx.fillText(`門派與身分：${life.sect}  |  代表武學：${life.topArt}`, 28, 190);
      ctx.fillText(`命終死因：${life.deathCause}`, 28, 224);
      ctx.fillText(`最終狀態：體魄 ${Math.round(life.stats.health)} · 心境 ${Math.round(life.stats.mind)} · 武學 ${Math.round(life.stats.martial)} · 情義 ${Math.round(life.stats.bonds)}`, 28, 258);
    } else {
      ctx.fillText(`當地平均預期壽元：男 ${life.region.leM} 歲 / 女 ${life.region.leF} 歲 · 五歲內夭折率 ${life.region.u5Mort}%`, 28, 190);
      ctx.fillText(`當地習武機緣率：${life.region.martialRate}% · 代表武學：${life.region.artsPool.join('、')}`, 28, 224);
    }

    ctx.fillStyle = '#627276';
    ctx.font = '13px monospace';
    ctx.fillText(`JH<${life.region.code}<<${life.idAscii}<<<1IN80MILLION<JIANGHU<TRIBUTE<TO<1IN8B.LIFE`, 28, 388);

    const link = document.createElement('a');
    link.download = `jianghu_${life.serial}_${isDead ? 'epitaph' : 'birth'}.png`;
    link.href = cv.toDataURL('image/png');
    link.click();
    showToast('已生成並下載江湖圖卡！');
  }

  // 檢視全部 20 大疆域與門第統計總表 Modal
  function openAllRegionsModal() {
    const modal = $('modal');
    modal.hidden = false;
    modal.innerHTML = `
      <div class="dec" style="width:min(820px,100%)" role="dialog" aria-modal="true">
        <div class="hd">
          <span>《大宋與塞外戶部及江湖百曉生統計清冊》· 全 20 大疆域門第</span>
          <button type="button" class="decmin" id="closeAllRegBtn">關閉</button>
        </div>
        <div class="bd" style="max-height:75vh;overflow-y:auto">
          <h2>20 大疆域與門第出生機率、壽元與習武統計</h2>
          <p style="font-size:13.5px">本表致敬 <code>1in8b.life</code> 的 172 國統計結構，將宋元明歷史人口、民生經濟與金庸武俠門派分佈結合：</p>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums">
              <thead>
                <tr style="border-bottom:2px solid var(--rule);text-align:left">
                  <th style="padding:6px">疆域與門第</th>
                  <th style="padding:6px">階層</th>
                  <th style="padding:6px;text-align:right">出生佔比</th>
                  <th style="padding:6px;text-align:right">壽元(男/女)</th>
                  <th style="padding:6px;text-align:right">5歲夭折</th>
                  <th style="padding:6px;text-align:right">歲入紋銀</th>
                  <th style="padding:6px;text-align:right">習武率</th>
                </tr>
              </thead>
              <tbody>
                ${DATA.REGIONS.map((r) => `
                  <tr style="border-bottom:1px solid var(--rule2)">
                    <td style="padding:6px;font-weight:600">${r.name}</td>
                    <td style="padding:6px;color:var(--ink2)">${r.stratum}</td>
                    <td style="padding:6px;text-align:right;font-family:var(--f-mono)">${r.birthShare}%</td>
                    <td style="padding:6px;text-align:right">${r.leM} / ${r.leF}</td>
                    <td style="padding:6px;text-align:right">${r.u5Mort}%</td>
                    <td style="padding:6px;text-align:right">${r.incomeSilver}兩</td>
                    <td style="padding:6px;text-align:right;color:var(--stamp);font-weight:600">${r.martialRate}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    $('closeAllRegBtn').addEventListener('click', () => { modal.hidden = true; });
  }

  function updateSpeedUI() {
    const pBtn = $('pauseBtn');
    if (pBtn) pBtn.setAttribute('aria-pressed', String(paused));
    document.querySelectorAll('#spSet button').forEach((b) => {
      b.setAttribute('aria-pressed', String(!paused && Number(b.dataset.speed) === speed));
    });
  }

  // ==================== 綁定所有事件與啟動 ====================
  function initApp() {
    // 填入現實對照選單
    const homeSel = $('homeSel');
    if (homeSel) {
      homeSel.innerHTML = DATA.REAL_HOMES.map((h) => `<option value="${h.id}">${h.name}</option>`).join('');
      homeSel.addEventListener('change', () => { cfg.home = homeSel.value; });
    }

    // 紀元切換
    document.querySelectorAll('[data-era]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-era]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        cfg.era = btn.dataset.era;
        const eObj = DATA.ERAS[cfg.era];
        $('eraHint').textContent = eObj ? eObj.hint : '任憑天命隨機降生於北宋、南宋或元末明初的江湖。';
      });
    });

    // 抽選方式切換
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        cfg.mode = btn.dataset.mode;
        renderIntroOdds();
      });
    });

    // 人生長度節奏切換
    document.querySelectorAll('[data-pace]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-pace]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        cfg.pace = Number(btn.dataset.pace);
      });
    });

    // 明暗主題切換
    const toggleTheme = () => {
      const root = document.documentElement;
      const cur = root.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      showToast(`畫面明暗已切換為：${next === 'dark' ? '夜讀水墨（深色）' : '宣紙卷宗（淺色）'}`);
    };
    if ($('themeBtn')) $('themeBtn').addEventListener('click', toggleTheme);
    if ($('themeBtn2')) $('themeBtn2').addEventListener('click', toggleTheme);

    // 音樂開關
    document.querySelectorAll('[data-music]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const on = window.JianghuAudio.toggleMusic();
        document.querySelectorAll('[data-music]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
        showToast(on ? '♪ 已撫響古琴雅樂（五聲泛音）' : '♪ 已止息古琴雅樂');
      });
    });

    // 統計總表按鈕
    if ($('allStatsBtn')) $('allStatsBtn').addEventListener('click', openAllRegionsModal);

    // 開始投胎與踏入人生
    if ($('startBtn')) $('startBtn').addEventListener('click', startBirthRoll);
    if ($('beginBtn')) $('beginBtn').addEventListener('click', beginLifeSimulation);
    if ($('certCardBtn')) $('certCardBtn').addEventListener('click', () => exportShareCard(false));

    // 時間控制列
    if ($('pauseBtn')) {
      $('pauseBtn').addEventListener('click', () => {
        paused = !paused;
        fastForwarding = false;
        updateSpeedUI();
      });
    }
    document.querySelectorAll('#spSet button').forEach((btn) => {
      btn.addEventListener('click', () => {
        paused = false;
        fastForwarding = false;
        speed = Number(btn.dataset.speed);
        updateSpeedUI();
      });
    });
    if ($('ffBtn')) {
      $('ffBtn').addEventListener('click', () => {
        paused = false;
        fastForwarding = !fastForwarding;
        $('ffBtn').setAttribute('aria-pressed', String(fastForwarding));
        showToast(fastForwarding ? '正在快轉至下一個人生十字路口...' : '已恢復正常時間流速');
      });
    }
    if ($('autoBtn')) {
      $('autoBtn').addEventListener('click', () => {
        autoDecide = !autoDecide;
        $('autoBtn').setAttribute('aria-pressed', String(autoDecide));
        showToast(autoDecide ? '已開啟「自動抉擇」：你可以靜靜旁觀此人的一生' : '已關閉「自動抉擇」');
        if (autoDecide && pendingDecision && pendingDecision.choices) {
          applyDecisionChoice(pendingDecision, pick(pendingDecision.choices));
        }
      });
    }
    if ($('pauseQ')) {
      $('pauseQ').addEventListener('click', () => {
        cfg.pauseReflect = !cfg.pauseReflect;
        $('pauseQ').setAttribute('aria-pressed', String(cfg.pauseReflect));
        showToast(cfg.pauseReflect ? '已開啟 7/16/30/50/70 歲駐足省思' : '已略過駐足省思提問');
      });
    }
    if ($('goShop')) $('goShop').addEventListener('click', openShopModal);
    if ($('decOpen')) {
      $('decOpen').addEventListener('click', () => {
        if (pendingDecision) {
          $('modal').hidden = false;
          $('decPeek').hidden = true;
        }
      });
    }
    if ($('quitBtn')) {
      $('quitBtn').addEventListener('click', () => {
        clearInterval(progTimer);
        $('lifeview').hidden = true;
        $('intro').hidden = false;
        renderMemorials();
        renderPastLives();
      });
    }

    renderIntroOdds();
    renderMemorials();
    renderPastLives();
    startIntroTicker();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
