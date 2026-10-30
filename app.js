// 《江湖蒼生錄 · 八千萬眾》主程式邏輯（獨創武俠案頭、全景沙盤與對開古籍版面）

(function () {
  const DATA = window.JIANGHU_DATA;

  const cfg = {
    era: 'south_song',
    mode: 'birth',
    pace: 30,
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

  let introBirths = 0;
  let introDeaths = 0;
  const mapPulses = [];

  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  const $ = (id) => document.getElementById(id);

  function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, v));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getGanZhi(year) {
    const g = GAN[(year - 4) % 10];
    const z = ZHI[(year - 4) % 12];
    return `${g}${z}年`;
  }

  function getClassicalAgeTitle(age, sex) {
    if (age <= 1) return '襁褓';
    if (age <= 6) return '孩提';
    if (age <= 12) return '垂髫總角';
    if (age <= 15) return sex === 'F' ? '及笄之年' : '束髮少年';
    if (age <= 24) return sex === 'F' ? '花信芳華' : '弱冠少年';
    if (age <= 34) return '而立之年';
    if (age <= 44) return '不惑壯年';
    if (age <= 54) return '知命之年';
    if (age <= 64) return '耳順暮年';
    return '古稀高壽';
  }

  function showToast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.hidden = true; }, 2800);
  }

  function getRealm(martial) {
    let cur = DATA.REALMS[0];
    for (const r of DATA.REALMS) {
      if (martial >= r.min) cur = r;
    }
    return cur;
  }

  function calcSurvivalRate(region, sex, age) {
    const le = sex === 'F' ? region.leF : region.leM;
    const u5 = region.u5Mort / 100;
    if (age <= 0) return 100;
    if (age <= 5) {
      return Math.round((1 - u5 * (age / 5)) * 100);
    }
    const post5 = 1 - u5;
    const halfAge = le + 4;
    const k = 0.085;
    const s = post5 / (1 + Math.exp(k * (age - halfAge)));
    return clamp(Math.round(s * 100), 0, 100);
  }

  function rollRegion(mode = cfg.mode) {
    const list = DATA.REGIONS;
    const weights = list.map((r) => {
      if (mode === 'hero') {
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

  function buildLuyinTally(p) {
    const boneWeight = p.region.zone === '名門世家'
      ? '五兩八錢 · 根骨奇佳名震九州之命'
      : (p.region.zone === '江湖底層' ? '三兩六錢 · 離祖闖蕩白手成家之命' : '二兩九錢 · 黎庶勞碌守分求安之命');
    const passOffice = p.region.name.split(' · ')[0] + '官署給引';
    return `
      <div class="luyin-text">
        <div><b>【稱骨批命】</b>${boneWeight}</div>
        <div><b>【關津勘合】</b>${passOffice} · 渡口關隘驗明正身准行</div>
      </div>
      <span class="seal-stamp">江湖<br>通行</span>
    `;
  }

  function generatePeers(eraObj, birthYear) {
    const peers = [];
    for (let i = 0; i < 4; i++) {
      const { region } = rollRegion('birth');
      const sex = Math.random() < 0.49 ? 'F' : 'M';
      const name = genName(region, sex);
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

    const wealthRoll = Math.random();
    let familyTier = '尋常溫飽人家';
    let incomeMult = 1.0;
    if (region.zone === '名門世家') {
      familyTier = '鐘鳴鼎食 · 武林名門';
      incomeMult = 1.6;
    } else if (wealthRoll < 0.35) {
      familyTier = '家徒四壁 · 貧苦寒門';
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
      sect: region.zone === '名門世家' ? pick(region.sectPool) : '無門無派（白身）',
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
      grid: [],
      trail: [[region.coords[0], region.coords[1]]],
      usedDecisions: {},
      reflections: {}
    };
  }

  // ==================== 首頁三大階層牌位渲染（取代原版長條圖列表） ====================
  function renderIntroOdds() {
    const box = $('oddsList');
    if (!box) return;
    const mortals = DATA.REGIONS.filter((r) => r.zone !== '江湖底層' && r.zone !== '名門世家');
    const fringes = DATA.REGIONS.filter((r) => r.zone === '江湖底層');
    const elites  = DATA.REGIONS.filter((r) => r.zone === '名門世家');

    const getShare = (r) => (cfg.mode === 'pop' ? r.popShare : r.birthShare);

    box.innerHTML = `
      <div class="tier-col">
        <h3><span>【凡塵黎庶】</span><span class="seal-stamp">約 90%</span></h3>
        <p class="t-desc">中原農戶、江南市井與塞外牧民，終生為溫飽與賦稅奔波，偶有奇遇方入武林。</p>
        <div class="tier-tags">
          ${mortals.map((r) => `<div class="tier-item"><span>${r.name}</span><span>${getShare(r).toFixed(1)}%</span></div>`).join('')}
        </div>
      </div>

      <div class="tier-col t-mid">
        <h3><span>【江湖外圍】</span><span class="seal-stamp">約 8.5%</span></h3>
        <p class="t-desc">丐幫小乞、鏢局趟子手、少林武當雜役與綠林嘍囉，自幼習粗淺拳腳，刀口舔血。</p>
        <div class="tier-tags">
          ${fringes.map((r) => `<div class="tier-item"><span>${r.name}</span><span>${getShare(r).toFixed(1)}%</span></div>`).join('')}
        </div>
      </div>

      <div class="tier-col t-ssr">
        <h3><span>【名門世家】</span><span class="seal-stamp">僅 1.5%</span></h3>
        <p class="t-desc">萬中無一的天之驕子。生於武林世家、姑蘇慕容、大理段氏或桃花古墓遺脈。</p>
        <div class="tier-tags">
          ${elites.map((r) => `<div class="tier-item"><span>${r.name}</span><span>${getShare(r).toFixed(2)}%</span></div>`).join('')}
        </div>
      </div>
    `;
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
          <span>歿因：${m.cause}</span>
          <button type="button" class="incense-btn" data-inc="${idx}">🕯 奉香 (${m.incense || 1})</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.incense-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        btn.setAttribute('aria-pressed', 'true');
        const m = all[Number(btn.dataset.inc)];
        m.incense = (m.incense || 1) + 1;
        btn.textContent = `🕯 已奉香 (${m.incense})`;
        showToast(`你向「${m.name}」的靈位奉上了一炷清香。`);
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
    sum.textContent = `已載錄 ${past.length} 卷往生傳記`;
    body.innerHTML = past.slice(0, 8).map((p) => `
      <li class="pl" style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dashed var(--rule-inner)">
        <div>
          <b style="font-family:var(--f-display);font-size:16px">${p.name}</b> <span style="color:var(--ink2);font-size:13px">（${p.sex === 'F' ? '女' : '男'} · 享年 ${p.age} 歲 · ${p.eraShort}）</span>
          <div style="font-size:12.5px;color:var(--ink3)">${p.regionName} · ${p.sect} · 武學：${p.realm} · 終局：${p.deathCause}</div>
        </div>
        <span class="mono" style="font-size:12px;color:var(--gold)">${p.birthYear}–${p.birthYear + p.age}</span>
      </li>
    `).join('');
  }

  function startIntroTicker() {
    setInterval(() => {
      if (!$('intro') || $('intro').hidden) return;
      if (Math.random() < 0.75) {
        introBirths += Math.floor(1 + Math.random() * 3);
        const { region } = rollRegion('birth');
        mapPulses.push({ x: region.coords[0], y: region.coords[1], r: 3, alpha: 0.9, type: 'birth' });
        $('tgFeed').textContent = `一名嬰孩於「${region.name}」呱呱墜地（當地五歲內夭折率 ${region.u5Mort}%）`;
      }
      if (Math.random() < 0.55) {
        introDeaths += Math.floor(1 + Math.random() * 2);
        const { region } = rollRegion('pop');
        mapPulses.push({ x: region.coords[0], y: region.coords[1], r: 3, alpha: 0.9, type: 'death' });
      }
      $('cBirth').textContent = introBirths.toLocaleString();
      $('cDeath').textContent = introDeaths.toLocaleString();
    }, 1100);

    function animMap() {
      if ($('intro') && !$('intro').hidden) {
        for (let i = mapPulses.length - 1; i >= 0; i--) {
          mapPulses[i].r += 0.35;
          mapPulses[i].alpha -= 0.02;
          if (mapPulses[i].alpha <= 0) mapPulses.splice(i, 1);
        }
        window.JianghuCanvas.drawJianghuMap($('tgMap'), { width: 860, height: 340, pulses: mapPulses });
      }
      requestAnimationFrame(animMap);
    }
    requestAnimationFrame(animMap);
  }

  // ==================== 投胎命盤與官府戶帖 (#roll) ====================
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
      rollMetaEl.textContent = `【${tempR.zone} · ${tempR.stratum}】命格比重 ${tempR.birthShare}%`;
      if (ticks >= maxTicks) {
        clearInterval(timer);
        rollNameEl.textContent = life.region.name;
        rollMetaEl.textContent = `【${life.eraObj.name} · ${life.region.stratum}】`;
        window.JianghuAudio.playChime('birth');
        setTimeout(showBirthCert, 650);
      }
    }, 75);
  }

  function showBirthCert() {
    $('roller').hidden = true;
    $('cert').hidden = false;

    $('certNo').textContent = `禮部戶帖字號：第 ${life.serial} 號`;
    $('certName').textContent = `${life.name}（${life.sex === 'F' ? '女' : '男'}）`;
    $('certStory').textContent = life.region.story;

    const le = life.sex === 'F' ? life.region.leF : life.region.leM;
    $('certFields').innerHTML = `
      <div><span class="lbl">降生州府疆域</span><b>${life.region.name}</b></div>
      <div><span class="lbl">家世門第</span><b>${life.familyTier}</b></div>
      <div><span class="lbl">生辰八字歲次</span><b>${life.eraObj.short} · ${getGanZhi(life.birthYear)}${life.shichen}</b></div>
      <div><span class="lbl">當地預期陽壽</span><b>${le} 歲（五歲內夭折率 ${life.region.u5Mort}%）</b></div>
      <div><span class="lbl">家門歲入紋銀</span><b>約 ${life.annualIncome} 兩 / 年（折合米 ${Math.round(life.annualIncome * 2.2)} 石）</b></div>
      <div><span class="lbl">當地習武機緣率</span><b>${life.region.martialRate}%（流傳武學：${life.region.artsPool[0]}）</b></div>
    `;

    window.JianghuCanvas.drawJianghuMap($('certMap'), {
      width: 480,
      height: 250,
      highlightId: life.region.id
    });

    $('certOdds').innerHTML = `<b>【百曉生命格批註】</b>在九州八千萬蒼生中，降生於「<b>${life.region.name}</b>」之機率為 <b>${life.birthProb.toFixed(2)}%</b>。${
      life.region.zone === '名門世家'
        ? '你生來便在武林名門鐘鳴鼎食之家，家傳絕學觸手可及，卻也身不由己捲入江湖恩怨！'
        : '如同江湖上九成以上的芸芸眾生，你生於尋常煙火人家，沒有天降神功，唯有憑雙手在亂世中求索。'
    }`;

    $('certComps').innerHTML = `
      <span class="lbl">同一時辰（${life.shichen}）於九州四方啼哭降生的另外四人</span>
      <ul>
        ${life.peers.map((p) => `
          <li>
            <b>${p.name}（${p.sex === 'F' ? '女' : '男'}）</b>
            <span>生於 ${p.region.name} · 預期陽壽 ${p.sex === 'F' ? p.region.leF : p.region.leM} 歲</span>
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

    addFeedLog(
      0,
      `於${life.eraObj.short}（${life.birthYear}年 · ${getGanZhi(life.birthYear)}）${life.shichen}，降生於「${life.region.name}」之${life.familyTier}，取名「${life.name}」。`,
      `當地出生比重 ${life.region.birthShare}% · 五歲內夭折率 ${life.region.u5Mort}% · 戶部魚鱗清冊`,
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

    const foObj = DATA.FOCUSES.find((f) => f.id === life.focus) || DATA.FOCUSES[0];
    life.stats.health = clamp(life.stats.health + foObj.fx.health + (age > 45 ? -(age - 42) * 0.08 : 0));
    life.stats.mind   = clamp(life.stats.mind + foObj.fx.mind);
    const martialCapMod = (life.sect.includes('白身') && r.zone !== '名門世家') ? 0.65 : 1.15;
    life.stats.martial = clamp(life.stats.martial + foObj.fx.martial * martialCapMod);
    life.stats.bonds  = clamp(life.stats.bonds + foObj.fx.bonds);

    if (age >= 14) {
      const realmBonus = Math.max(0, (life.stats.martial - 20) * 0.25);
      const yrInc = Math.round((r.incomeSilver * life.incomeMult * foObj.fx.silverMod + realmBonus + life.passiveIncome) * 10) / 10;
      life.annualIncome = yrInc;
      const livingCost = Math.round(yrInc * 0.68 * 10) / 10;
      life.silver = Math.max(0, Math.round((life.silver + yrInc - livingCost) * 10) / 10);
    }

    life.peers.forEach((p) => {
      if (!p.alive) return;
      if (age >= p.deathAge) {
        p.alive = false;
        p.statusText = `卒於 ${age} 歲（${p.deathCause}）`;
        addFeedLog(age, `與你同一時辰降生於「${p.region.name}」的 ${p.name}，於今年因「${p.deathCause}」離世，得年 ${age} 歲。`, `同辰五人命盤 · 當地預期陽壽 ${p.sex === 'F' ? p.region.leF : p.region.leM} 歲`, 'comp');
      } else if (age === 7) {
        p.statusText = p.region.literacy > 45 ? '入私塾開蒙識字' : '在田間幫補生計';
      } else if (age === 15) {
        p.statusText = p.art !== '無' ? `拜入「${p.sect}」，修習${p.art}` : `以「${p.sect}」營生`;
      } else if (age === 22) {
        p.statusText = Math.random() < 0.7 ? `於${p.region.name.split(' · ')[0]}成家立業` : `仗劍獨行江湖（${p.sect}）`;
      } else if (age === 40) {
        p.statusText = p.art !== '無' ? `已成地方名家，精擅${p.art}` : '操持家業，撫育兒女';
      } else if (age === 60) {
        p.statusText = '兩鬢霜白，含飴弄孫';
      }
    });

    ['father', 'mother'].forEach((k) => {
      const par = life.family[k];
      if (par.alive && age + 24 >= par.deathAge) {
        par.alive = false;
        life.stats.mind = clamp(life.stats.mind - 8);
        addFeedLog(age, `${k === 'father' ? '父親' : '母親'}積勞病故（享年 ${par.deathAge} 歲），你在墳前結廬守孝。`, `高齡雙親存世率 · 傳統丁憂禮制`, 'loss');
      }
    });

    const histList = DATA.HIST_EVENTS[life.eraKey] || [];
    const histHit = histList.find((h) => h.yearOffset === age);
    if (histHit) {
      addFeedLog(age, histHit.text, histHit.stat, 'hist');
    }

    let gridBadge = '';
    let gridState = life.stats.mind >= 68 ? 'hi' : (life.stats.mind <= 38 ? 'lo' : 'mid');
    triggerYearlyRandomEvent(age, (b) => { gridBadge = b; });

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

    ensureValidFocus();
    updateAllLifePanels();

    if (cfg.pauseReflect && DATA.REFLECTIONS[age] && !life.reflections[age] && !autoDecide) {
      fastForwarding = false;
      openReflectionModal(age);
      return;
    }

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
        addFeedLog(age, `在${r.name.split(' · ')[0]}的屋簷下蹒跚學步，抓著竹蜻蜓與泥人玩耍。`, `五歲內幼童存活率 · 體魄 ${Math.round(life.stats.health)}`);
      } else if (roll < 0.55) {
        life.stats.health = clamp(life.stats.health - 5);
        addFeedLog(age, `入冬時染上一場風寒高熱，幸得母親徹夜熬煮薑湯照料方才退燒。`, `古代小兒冬季傷寒染病率 34%`, 'bad');
      }
      return;
    }

    if (life.stats.martial >= 18 && life.topArt === '無' && Math.random() < 0.45) {
      life.topArt = pick(r.artsPool);
      setBadge('武');
      addFeedLog(age, `經過日夜苦練，你終於領悟了「${life.topArt}」的精要，在同輩中嶄露頭角！`, `武學修習突破率 · 當前武學 ${Math.round(life.stats.martial)}`, 'ms');
      return;
    }

    if (life.family.spouse && life.family.spouse.alive && age >= 20 && age <= 42 && life.family.children.length < 3 && Math.random() < 0.22) {
      const cSex = Math.random() < 0.5 ? 'F' : 'M';
      const cName = genName(r, cSex);
      life.family.children.push({ name: cName, sex: cSex, birthAge: age });
      life.stats.mind = clamp(life.stats.mind + 8);
      life.stats.bonds = clamp(life.stats.bonds + 8);
      setBadge('子');
      addFeedLog(age, `家中添丁之喜！伴侶為你誕下一${cSex === 'F' ? '女' : '子'}，取名「${cName}」。`, `大宋戶部生育統計 · 血脈延續`, 'ms');
      return;
    }

    if (roll < 0.16) {
      const bonus = Math.round(r.incomeSilver * 0.4 * 10) / 10;
      life.silver = Math.round((life.silver + bonus) * 10) / 10;
      life.stats.mind = clamp(life.stats.mind + 4);
      addFeedLog(age, `今年風調雨順，市集買賣興隆，手頭多攢下了 ${bonus} 兩紋銀。`, `地方歲收豐歉波動 · 歲入穩定`);
    } else if (roll < 0.30) {
      life.stats.health = clamp(life.stats.health - 6);
      life.silver = Math.max(0, Math.round((life.silver - 2) * 10) / 10);
      addFeedLog(age, `夏秋之交疫癘與旱情蔓延，只得節衣縮食、抓藥調理身體。`, `地方州縣災荒發生率 ${Math.round(r.warRisk * 0.8)}%`, 'bad');
    } else if (roll < 0.44 && (life.focus === 'outer' || life.focus === 'inner' || life.stats.martial >= 25)) {
      life.stats.martial = clamp(life.stats.martial + 3.5);
      addFeedLog(age, `於渡口茶肆偶遇一名遊方武師，雙方點到為止切磋數招，對「${life.topArt !== '無' ? life.topArt : r.artsPool[0]}」頗有進益。`, `江湖同道切磋勝率 · 武學 ${Math.round(life.stats.martial)}`);
    } else if (roll < 0.56) {
      life.stats.bonds = clamp(life.stats.bonds + 3);
      addFeedLog(age, `中秋月圓之夜，與親友鄰里分食月餅、聽茶館說書人講述早年五絕與大俠的傳說。`, `常年道心安定指數 · 心境 ${Math.round(life.stats.mind)}`);
    }
  }

  function checkMortality(age) {
    const r = life.region;
    const le = life.sex === 'F' ? r.leF : r.leM;

    if (age <= 5) {
      const yearlyU5Prob = (r.u5Mort / 100) / 5.2;
      if (Math.random() < yearlyU5Prob * (life.stats.health < 50 ? 1.3 : 0.85)) {
        return {
          died: true,
          cause: age <= 1 ? '襁褓驚風與先天不足早夭' : '幼年高熱疫病與飢寒早夭',
          statNote: `${r.name} 五歲以下夭折率 ${r.u5Mort}% · 戶部與歷史生命表模型`
        };
      }
    }

    if (life.stats.health <= 2) {
      return {
        died: true,
        cause: '氣血枯竭與沉痾宿疾併發而亡',
        statNote: `體魄降至臨界值 · 缺醫少藥環境致死率 92%`
      };
    }

    const hazardBase = (r.warRisk * life.eraObj.warMod + (life.focus === 'chivalry' ? r.feudRisk * 1.4 : r.feudRisk * 0.5)) / 2200;
    if (age >= 15 && Math.random() < hazardBase) {
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

    if (age > 28) {
      const ageRatio = (age - le) / 14;
      const healthMod = (100 - life.stats.health) / 65;
      const gompertzProb = 0.008 * Math.exp(ageRatio * 1.65) * (0.6 + healthMod);
      if (Math.random() < gompertzProb) {
        return {
          died: true,
          cause: age >= le ? '壽終正寢，於榻上安詳瞑目' : pick(r.causes),
          statNote: `${r.name} 陽壽生命表（預期壽元 ${le} 歲）· 享年 ${age} 歲`
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

    if (autoDecide) {
      const idx = Math.floor(Math.random() * dec.choices.length);
      applyDecisionChoice(dec, dec.choices[idx]);
      return;
    }

    const modal = $('modal');
    modal.hidden = false;
    $('decPeek').hidden = true;

    const cnNums = ['壹', '貳', '參', '肆'];
    modal.innerHTML = `
      <div class="dec" role="dialog" aria-modal="true">
        <div class="hd">
          <span>【江湖十字路口 · ${life.age} 歲（${getGanZhi(life.birthYear + life.age)}）】</span>
          <span>
            <button type="button" class="decmin" id="decMinBtn">暫且擱置 · 環顧四周</button>
          </span>
        </div>
        <div class="bd">
          <h2>${dec.title}</h2>
          <p>${dec.desc}</p>
          <div class="fact">【百曉生考據】${dec.fact}</div>
          <div class="ch">
            ${dec.choices.map((c, i) => `
              <button type="button" data-cidx="${i}">
                <span class="k">${cnNums[i] || (i + 1)}</span>
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
        extraNote = `（奇遇大成！貫通任督二脈，武學暴漲 +22！）`;
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
        extraNote = `（三拳兩腳擊退惡徒，滿座喝采，俠名遠播！）`;
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
      `${dec.title}：你選擇了「${ch.label}」——${ch.log}${extraNote}`,
      dec.fact,
      'dec'
    );

    pendingDecision = null;
    $('modal').hidden = true;
    $('decPeek').hidden = true;
    updateAllLifePanels();
  }

  function openReflectionModal(age) {
    const ref = DATA.REFLECTIONS[age];
    if (!ref) return;
    pendingDecision = { type: 'reflection', age };
    const modal = $('modal');
    modal.hidden = false;

    modal.innerHTML = `
      <div class="dec pause" role="dialog" aria-modal="true">
        <div class="hd">
          <span>✎ 駐馬省思 · ${ref.title}</span>
          <span>銅壺滴漏已為你暫停</span>
        </div>
        <div class="bd">
          <h2>在 ${life.name} 的 ${age} 歲，停步回望</h2>
          <p class="q" style="font-family:var(--f-display);font-size:18px;color:var(--ink)">${ref.q}</p>
          <textarea id="refInput" rows="3" placeholder="提筆留下一行墨跡（選填，將載入最終的武林列傳）..."></textarea>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="ghost sm" id="refSkipBtn">收筆，繼續江湖路</button>
            <button type="button" class="cta sm" id="refSaveBtn">題字入卷，繼續前行</button>
          </div>
        </div>
      </div>
    `;

    const closeRef = (saveText) => {
      const val = (saveText ? $('refInput').value.trim() : '');
      life.reflections[age] = val || '（默然佇立，未留字句）';
      if (val) {
        addFeedLog(age, `【省思手札】「${val}」`, `${ref.title} · 題字手札`, 'note');
      }
      pendingDecision = null;
      modal.hidden = true;
      updateAllLifePanels();
    };

    $('refSkipBtn').addEventListener('click', () => closeRef(false));
    $('refSaveBtn').addEventListener('click', () => closeRef(true));
  }

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
            <span>【九州坊市 · 置產與修煉】</span>
            <span>行囊盤纏：<b>${life.silver.toFixed(1)} 兩紋銀</b></span>
          </div>
          <div class="bd">
            <h2>藥鋪、鐵匠鋪與田契牙行</h2>
            <p style="font-size:13.5px">在江湖裡，銀兩雖買不到天命，卻能購置良田、延醫買藥或打製神兵防身。</p>
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
              <button type="button" class="ghost sm" id="shopCloseBtn">離開坊市</button>
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

          addFeedLog(life.age, `於坊市耗銀 ${item.cost} 兩置辦了「${item.name}」（${item.desc}）。`, `坊市銀票交割 · 餘銀 ${life.silver.toFixed(1)} 兩`, 'ms');
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
    const curYear = life.birthYear + life.age;

    $('ageNum').innerHTML = `${life.age}<small>歲</small>`;
    $('ageYear').textContent = `${life.eraObj.short} · ${curYear}年（${getGanZhi(curYear)}）· ${getClassicalAgeTitle(life.age, life.sex)}`;

    $('idTop').innerHTML = `《歲月行旅水墨手卷》 · 路引字號 ${life.serial}`;
    window.JianghuCanvas.drawPortrait($('portrait'), life);
    $('idName').innerHTML = `<span>${life.name}</span><span class="realm-pill">${realm.name}</span>`;
    $('idDl').innerHTML = `
      <dt>生辰</dt><dd>${life.sex === 'F' ? '女' : '男'} · ${getGanZhi(life.birthYear)}${life.shichen}</dd>
      <dt>籍貫</dt><dd>${r.name}</dd>
      <dt>門牆</dt><dd>${life.sect}</dd>
      <dt>絕藝</dt><dd>${life.topArt}（配刃：${life.weapon}）</dd>
    `;
    $('mrz').innerHTML = buildLuyinTally(life);

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

    const pppNTD = Math.round(life.annualIncome * 18500).toLocaleString();
    $('money').innerHTML = `
      <div>
        <span>歲入紋銀<b>${life.annualIncome.toFixed(1)} 兩/年</b></span>
        <small>購買力約合今 NT$ ${pppNTD}</small>
      </div>
      <div style="text-align:right">
        <span>行囊盤纏<b>${life.silver.toFixed(1)} 兩</b></span>
        <small>折合大宋白米約 ${Math.round(life.silver * 2.2)} 石</small>
      </div>
    `;
    $('spend').innerHTML = `
      <div class="sbar">
        <i style="width:48%;background:#8C6224"></i>
        <i style="width:22%;background:#245C4E"></i>
        <i style="width:18%;background:#9E2424"></i>
        <i style="width:12%;background:#6E6050"></i>
      </div>
      <div class="keys">
        <span style="--c:#8C6224">五穀伙食 48%</span>
        <span style="--c:#245C4E">湯藥調理 22%</span>
        <span style="--c:#9E2424">兵刃修練 18%</span>
        <span style="--c:#6E6050">人情香油 12%</span>
      </div>
    `;

    const famRows = [
      { role: '嚴父', val: life.family.father.name, alive: life.family.father.alive },
      { role: '慈母', val: life.family.mother.name, alive: life.family.mother.alive }
    ];
    if (life.family.master) {
      famRows.push({ role: '授業恩師', val: `${life.family.master.name}（${life.sect}）`, alive: life.family.master.alive });
    }
    if (life.family.spouse) {
      famRows.push({ role: life.family.spouse.type, val: life.family.spouse.name, alive: life.family.spouse.alive });
    } else if (life.age >= 18) {
      famRows.push({ role: '紅塵伴侶', val: '孤身未娶/未嫁', alive: true });
    }
    life.family.children.forEach((c, idx) => {
      famRows.push({ role: `子嗣 (${idx + 1})`, val: `${c.name}（${life.age - c.birthAge}歲）`, alive: true });
    });
    $('fam').innerHTML = famRows.map((row) => `
      <div class="row">
        <span>${row.role}</span>
        <span class="${row.alive ? '' : 'gone'}">${row.val}${row.alive ? '' : '（已故）'}</span>
      </div>
    `).join('');

    window.JianghuCanvas.drawScene($('scene'), life);
    const foNow = DATA.FOCUSES.find((f) => f.id === life.focus) || DATA.FOCUSES[0];
    $('sceneCap').textContent = `【${r.name}】${life.age}歲之${life.name}（${realm.name}），當歲正以「${foNow.name}」為修業重心。`;

    $('status').innerHTML = `${r.name} · ${life.sect}`;
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

    $('compList').innerHTML = life.peers.map((p) => `
      <li class="${p.alive ? '' : 'gone'}">
        <div class="cn">
          <b>${p.name}（${p.sex === 'F' ? '女' : '男'}）</b>
          <small>${p.region.name} · ${p.sect}</small>
        </div>
        <div class="cs">${p.statusText}</div>
      </li>
    `).join('');

    const leAge = Math.round(life.sex === 'F' ? r.leF : r.leM);
    let cellsHTML = '';
    for (let i = 0; i < 90; i++) {
      const g = life.grid[i];
      const isCur = i === life.age && life.alive;
      const isLe = i === leAge;
      let bg = 'var(--card2)';
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
      cellsHTML += `<div class="${cls}" style="background:${bg}" title="${g ? g.note : `第 ${i} 歲${isLe ? '（當地平均陽壽）' : ''}`}">${badge}</div>`;
    }
    $('grid').innerHTML = cellsHTML;

    renderSurvivalChart();

    $('ctyTitle').textContent = `《${r.name.split(' · ')[0]}風物與門第志》`;
    $('ctyDl').innerHTML = `
      <dt>疆域門第</dt><dd>${r.zone} · ${r.stratum}</dd>
      <dt>占江湖出生人口比</dt><dd>${r.birthShare}%</dd>
      <dt>預期陽壽（男 / 女）</dt><dd>${r.leM} 歲 / ${r.leF} 歲</dd>
      <dt>五歲內夭折率</dt><dd>${r.u5Mort}%</dd>
      <dt>人均歲入紋銀</dt><dd>${r.incomeSilver} 兩</dd>
      <dt>蒙學識字率</dt><dd>${r.literacy}%</dd>
      <dt>習武入流比例</dt><dd>${r.martialRate}%</dd>
      <dt>兵燹 / 江湖仇殺率</dt><dd>${r.warRisk}% / ${r.feudRisk}%</dd>
      <dt>代表門派絕學</dt><dd>${r.sectPool[0]} · ${r.artsPool[0]}</dd>
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
    const avgRegion = DATA.REGIONS[3];
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
        <text x="${padL}" y="${h - 4}" font-size="9" fill="var(--ink3)">初生</text>
        <text x="${padL + pw * 0.5}" y="${h - 4}" font-size="9" fill="var(--ink3)" text-anchor="middle">不惑</text>
        <text x="${w - padR}" y="${h - 4}" font-size="9" fill="var(--ink3)" text-anchor="end">耄耋</text>
        <polyline fill="none" stroke="var(--ink3)" stroke-width="1.4" stroke-dasharray="3 3" points="${ptsAvg.join(' ')}"/>
        <polyline fill="none" stroke="var(--stamp)" stroke-width="2.2" points="${ptsRegion.join(' ')}"/>
        <circle cx="${curX}" cy="${curY}" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>
        <text x="${Math.min(w - 42, curX + 6)}" y="${Math.max(16, curY - 5)}" font-size="10" font-family="var(--f-display)" fill="var(--accent)" font-weight="bold">${life.age}歲 (${curSurv}%)</text>
      </svg>
    `;
  }

  // ==================== 謝世走馬燈劇場 (.ending) 與 中軸石碑雙翼列傳 (#dead) ====================
  function triggerEndingSequence() {
    clearInterval(progTimer);
    savePastLifeRecord();

    const highlights = life.logs.filter((l) => l.starred || l.type === 'ms' || l.type === 'dec' || l.type === 'death').slice().reverse();
    const slides = highlights.length ? highlights.slice(0, 6) : life.logs.slice(0, 4).reverse();

    const endingEl = $('endingOverlay');
    endingEl.hidden = false;
    let idx = 0;

    function renderSlide(i) {
      const s = slides[i];
      $('endAge').textContent = `【${s.year}年 · ${getGanZhi(s.year)} · ${s.age} 歲】`;
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

    // 全新三欄式「中軸石碑 ＋ 左右雙翼列傳」版面配置
    $('dead').innerHTML = `
      <div class="stele-layout">
        <!-- 左翼：同辰降生五人命途榜 -->
        <div class="panel">
          <h3><span>《同辰五人蓋棺榜》</span><span class="lbl">${life.shichen}同生</span></h3>
          <ul class="lives5">
            ${all5.map((p) => `
              <li class="${p.isMe ? 'me' : ''}">
                <div class="ca">${p.age}<small style="font-size:12px">歲</small></div>
                <div>
                  <b>${p.name}（${p.sex === 'F' ? '女' : '男'}${p.isMe ? ' · 本傳' : ''}）</b>
                  <p>${p.regionName} · ${p.sect}<br>終局：${p.cause}</p>
                </div>
              </li>
            `).join('')}
          </ul>
          ${refEntries.length ? `
            <div style="margin-top:16px;border-top:1px dashed var(--rule);padding-top:12px">
              <span class="lbl">生平駐馬省思手札</span>
              <ul style="list-style:none;margin:6px 0 0;padding:0;font-size:13px">
                ${refEntries.map(([k, v]) => `<li style="padding:4px 0;border-bottom:1px dotted var(--rule-inner)"><b style="color:var(--gold)">${k}歲：</b>「${v}」</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- 中央矗立：石碑拓印本傳 -->
        <div class="stele-center">
          <div class="stele-head">百曉生武林譜 · 第 ${life.serial} 卷</div>
          <div style="font-size:13px;color:#B5A792">${life.eraObj.name}（${life.birthYear}–${life.birthYear + life.age}）</div>
          <h1 class="stele-title">故 ${life.name} 之碑</h1>
          <div><span class="seal-stamp" style="color:#E0665A;border-color:#E0665A">${realm.name} · 享年 ${life.age} 歲</span></div>
          <div class="stele-cause">終局：${life.deathCause}</div>

          <div class="stele-bio">
            <b>太史公／百曉生曰：</b>${life.name}者，${r.name.split(' · ')[0]}人氏，生於${life.familyTier}。生平歷 ${life.age} 載寒暑，終老時名列「<b>${life.sect}</b>」，武學修為臻至「<b>${realm.name}</b>」（所習絕藝：${life.topArt}）。
            考諸戶部清冊，同歲降生於當地之孩童，僅 <b>${survAtDeath}%</b> 能活至此壽數。一世浮沉，盡歸塵土。
          </div>

          <div class="stele-metrics">
            <div><small>籍貫門第 (比重 ${life.birthProb.toFixed(2)}%)</small><b>${r.name}</b></div>
            <div><small>隨身絕藝與配刃</small><b>${life.topArt} · ${life.weapon}</b></div>
            <div><small>身後遺留盤纏</small><b>紋銀 ${life.silver.toFixed(1)} 兩</b></div>
            <div><small>紅塵家室</small><b>${life.family.spouse ? `${life.family.spouse.name} (${life.family.children.length}子嗣)` : '孤身未娶/未嫁'}</b></div>
          </div>

          <div style="text-align:left;margin-top:14px">
            <label for="fwInput" style="font-size:12px;color:#D4A359;display:block;margin-bottom:4px">銘刻石碑墓誌銘（將立碑於首頁「忠烈碑林」）：</label>
            <textarea id="fwInput" rows="2" style="width:100%;background:#12100E;color:#EAE0CC;border:1px solid #5C4932;padding:8px;font:inherit;font-size:13.5px" placeholder="如：仗劍行千里，歸來仍是黃河岸邊的少年..."></textarea>
            <button type="button" class="cta sm" id="saveMemoBtn" style="width:100%;margin-top:6px">銘刻立碑入祠</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;margin-top:18px;padding-top:16px;border-top:1px dashed rgba(212,163,89,0.3)">
            <button type="button" class="cta" id="rebirthBtn">【再入江湖輪迴（重新落子）】</button>
            <div style="display:flex;gap:8px">
              <button type="button" class="ghost sm" id="shareDeadCardBtn" style="flex:1;background:#2A231B;color:#EAE0CC">下載古籍列傳圖卡</button>
              <button type="button" class="ghost sm" id="backIntroBtn" style="flex:1;background:#2A231B;color:#EAE0CC">返回案頭首頁</button>
            </div>
          </div>
        </div>

        <!-- 右翼：九州行跡圖 ＋ 古今人間考據對照 -->
        <div class="panel homecmp">
          <h3><span>《生平九州行跡圖》</span><span class="lbl">起落之地</span></h3>
          <canvas id="deadMapCanvas" width="460" height="220" style="width:100%;height:auto;border:1px solid var(--rule);margin-bottom:16px"></canvas>

          <h3><span>《古今人間考據對照》</span><span class="lbl">此世 vs 今生</span></h3>
          <table>
            <thead>
              <tr><th>指標</th><th>此世（${r.name.split(' · ')[0]}）</th><th>${homeObj.name}</th></tr>
            </thead>
            <tbody>
              <tr><td>預期陽壽</td><td>${life.sex === 'F' ? r.leF : r.leM} 歲（享年 ${life.age}）</td><td>${homeObj.le} 歲</td></tr>
              <tr><td>五歲夭折率</td><td>${r.u5Mort}%</td><td>${homeObj.u5}%</td></tr>
              <tr><td>蒙學識字率</td><td>${r.literacy}%</td><td>${homeObj.literacy}%</td></tr>
              <tr><td>年均購買力</td><td>紋銀 ${life.annualIncome.toFixed(1)} 兩</td><td>US$${homeObj.incomeUSD.toLocaleString()}</td></tr>
              <tr><td>兵燹橫死率</td><td>年化 ${(r.warRisk * 0.4).toFixed(1)}%</td><td>${homeObj.homicide}/十萬</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    window.JianghuCanvas.drawJianghuMap($('deadMapCanvas'), {
      width: 460,
      height: 220,
      highlightId: r.id,
      trail: life.trail
    });

    $('saveMemoBtn').addEventListener('click', () => {
      const q = $('fwInput').value.trim() || `生於${r.name}，走過一場無悔江湖。`;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem('jh_memorials') || '[]');
      } catch (e) {}
      saved.unshift({
        name: life.name,
        span: `${life.birthYear}–${life.birthYear + life.age} · 享年${life.age}歲`,
        origin: r.name,
        realm: `${getRealm(life.stats.martial).name} · ${life.sect}`,
        cause: life.deathCause,
        quote: q,
        incense: 1
      });
      localStorage.setItem('jh_memorials', JSON.stringify(saved.slice(0, 20)));
      $('saveMemoBtn').disabled = true;
      $('saveMemoBtn').textContent = '已立碑入祠';
      showToast('已將墓誌銘立碑於首頁「忠烈碑林」！');
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

  function exportShareCard(isDead = false) {
    if (!life) return;
    const cv = document.createElement('canvas');
    cv.width = 740;
    cv.height = 430;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#F6F0E0';
    ctx.fillRect(0, 0, 740, 430);
    ctx.strokeStyle = '#8C6224';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 716, 406);
    ctx.lineWidth = 1;
    ctx.strokeRect(17, 17, 706, 396);

    ctx.fillStyle = isDead ? '#221E1B' : '#4A3728';
    ctx.fillRect(18, 18, 704, 52);

    ctx.fillStyle = '#F5E8C7';
    ctx.font = 'bold 21px "Noto Serif TC", serif';
    ctx.fillText(isDead ? '《江湖蒼生錄 · 蓋棺武林列傳》' : '《江湖蒼生錄 · 官府出生戶帖》', 32, 51);
    ctx.font = '13px "Noto Serif TC", serif';
    ctx.fillText(`百曉生卷宗字號 第 ${life.serial} 號`, 520, 50);

    ctx.fillStyle = '#1C1814';
    ctx.font = 'bold 36px "Noto Serif TC", serif';
    const title = isDead
      ? `${life.name}（享年 ${life.age} 歲 · ${getRealm(life.stats.martial).name}）`
      : `${life.name}（降生於 ${life.region.name}）`;
    ctx.fillText(title, 34, 122);

    ctx.fillStyle = '#245C4E';
    ctx.font = 'bold 17px "Noto Serif TC", serif';
    ctx.fillText(`${life.eraObj.name} · 門第：${life.familyTier}（命格比重 ${life.birthProb.toFixed(2)}%）`, 34, 158);

    ctx.fillStyle = '#4A4035';
    ctx.font = '16px "Noto Serif TC", serif';
    if (isDead) {
      ctx.fillText(`師承與營生：${life.sect}  ｜  成名絕藝：${life.topArt}`, 34, 202);
      ctx.fillText(`蓋棺終局：${life.deathCause}`, 34, 236);
      ctx.fillText(`蓋棺四維：體魄 ${Math.round(life.stats.health)} · 心境 ${Math.round(life.stats.mind)} · 武學 ${Math.round(life.stats.martial)} · 情義 ${Math.round(life.stats.bonds)}`, 34, 270);
    } else {
      ctx.fillText(`當地預期陽壽：男 ${life.region.leM} 歲 / 女 ${life.region.leF} 歲 · 五歲內夭折率 ${life.region.u5Mort}%`, 34, 202);
      ctx.fillText(`當地習武入流率：${life.region.martialRate}% · 流傳武學：${life.region.artsPool.join('、')}`, 34, 236);
    }

    ctx.strokeStyle = '#9E2424';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(618, 315, 76, 76);
    ctx.fillStyle = '#9E2424';
    ctx.font = 'bold 20px "Noto Serif TC", serif';
    ctx.fillText('江湖', 636, 348);
    ctx.fillText('百曉', 636, 376);

    ctx.fillStyle = '#6E6050';
    ctx.font = '14px "Noto Serif TC", serif';
    ctx.fillText('《江湖蒼生錄 · 八千萬眾》— 金庸武俠人間模擬', 34, 386);

    const link = document.createElement('a');
    link.download = `jianghu_${life.serial}_${isDead ? 'biography' : 'birth'}.png`;
    link.href = cv.toDataURL('image/png');
    link.click();
    showToast('已拓印並下載古籍圖卡！');
  }

  function openAllRegionsModal() {
    const modal = $('modal');
    modal.hidden = false;
    modal.innerHTML = `
      <div class="dec" style="width:min(820px,100%)" role="dialog" aria-modal="true">
        <div class="hd">
          <span>《九州二十大疆域與門第戶部清冊》</span>
          <button type="button" class="decmin" id="closeAllRegBtn">闔上卷宗</button>
        </div>
        <div class="bd" style="max-height:75vh;overflow-y:auto">
          <h2>二十大疆域門第出生比重、預期陽壽與習武入流考</h2>
          <p style="font-size:13.5px">結合宋元明歷史人口地理與金庸武俠門派分佈：</p>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums">
              <thead>
                <tr style="border-bottom:2px solid var(--rule);text-align:left">
                  <th style="padding:6px">疆域與門第</th>
                  <th style="padding:6px">階層</th>
                  <th style="padding:6px;text-align:right">出生比重</th>
                  <th style="padding:6px;text-align:right">陽壽(男/女)</th>
                  <th style="padding:6px;text-align:right">五歲夭折</th>
                  <th style="padding:6px;text-align:right">歲入紋銀</th>
                  <th style="padding:6px;text-align:right">習武率</th>
                </tr>
              </thead>
              <tbody>
                ${DATA.REGIONS.map((r) => `
                  <tr style="border-bottom:1px solid var(--rule-inner)">
                    <td style="padding:6px;font-weight:700;font-family:var(--f-display)">${r.name}</td>
                    <td style="padding:6px;color:var(--ink2)">${r.stratum}</td>
                    <td style="padding:6px;text-align:right;font-family:var(--f-mono)">${r.birthShare}%</td>
                    <td style="padding:6px;text-align:right">${r.leM} / ${r.leF}</td>
                    <td style="padding:6px;text-align:right">${r.u5Mort}%</td>
                    <td style="padding:6px;text-align:right">${r.incomeSilver}兩</td>
                    <td style="padding:6px;text-align:right;color:var(--stamp);font-weight:700">${r.martialRate}%</td>
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

  function initApp() {
    const homeSel = $('homeSel');
    if (homeSel) {
      homeSel.innerHTML = DATA.REAL_HOMES.map((h) => `<option value="${h.id}">${h.name}</option>`).join('');
      homeSel.addEventListener('change', () => { cfg.home = homeSel.value; });
    }

    // 首頁三書籤分頁切換
    document.querySelectorAll('[data-introt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.introt;
        document.querySelectorAll('[data-introt]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', String(on));
        });
        ['altar', 'hierarchy', 'memorial'].forEach((k) => {
          const pane = $(`pane-${k}`);
          if (pane) pane.hidden = k !== target;
        });
      });
    });

    // 主畫面右側《百曉生玄機匣》三書籤分頁切換
    document.querySelectorAll('[data-foliot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.foliot;
        document.querySelectorAll('[data-foliot]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', String(on));
        });
        ['bonds', 'fate', 'dossier'].forEach((k) => {
          const pane = $(`fpane-${k}`);
          if (pane) pane.hidden = k !== target;
        });
      });
    });

    document.querySelectorAll('[data-era]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-era]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        cfg.era = btn.dataset.era;
        const eObj = DATA.ERAS[cfg.era];
        $('eraHint').textContent = eObj ? eObj.hint : '任憑天命隨機降生於北宋、南宋或元末明初的江湖。';
      });
    });

    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        cfg.mode = btn.dataset.mode;
        renderIntroOdds();
      });
    });

    document.querySelectorAll('[data-pace]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-pace]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        cfg.pace = Number(btn.dataset.pace);
      });
    });

    const toggleTheme = () => {
      const root = document.documentElement;
      const cur = root.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      showToast(`書卷明暗已切換為：${next === 'dark' ? '夜雨客棧（深色）' : '宋刻宣紙（淺色）'}`);
    };
    if ($('themeBtn')) $('themeBtn').addEventListener('click', toggleTheme);

    document.querySelectorAll('[data-music]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const on = window.JianghuAudio.toggleMusic();
        document.querySelectorAll('[data-music]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
        showToast(on ? '♪ 已撫響古琴雅樂（五聲泛音）' : '♪ 已止息古琴雅樂');
      });
    });

    if ($('allStatsBtn')) $('allStatsBtn').addEventListener('click', openAllRegionsModal);
    if ($('allStatsBtn2')) $('allStatsBtn2').addEventListener('click', openAllRegionsModal);
    if ($('startBtn')) $('startBtn').addEventListener('click', startBirthRoll);
    if ($('beginBtn')) $('beginBtn').addEventListener('click', beginLifeSimulation);
    if ($('certCardBtn')) $('certCardBtn').addEventListener('click', () => exportShareCard(false));

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
        showToast(fastForwarding ? '正在策馬快轉至下一個江湖機緣...' : '已恢復正常歲月流速');
      });
    }
    if ($('autoBtn')) {
      $('autoBtn').addEventListener('click', () => {
        autoDecide = !autoDecide;
        $('autoBtn').setAttribute('aria-pressed', String(autoDecide));
        showToast(autoDecide ? '已開啟「聽憑天命（自動抉擇）」：可靜觀此人一生浮沉' : '已改回親手抉擇');
        if (autoDecide && pendingDecision && pendingDecision.choices) {
          applyDecisionChoice(pendingDecision, pick(pendingDecision.choices));
        }
      });
    }
    if ($('pauseQ')) {
      $('pauseQ').addEventListener('click', () => {
        cfg.pauseReflect = !cfg.pauseReflect;
        $('pauseQ').setAttribute('aria-pressed', String(cfg.pauseReflect));
        showToast(cfg.pauseReflect ? '已開啟駐馬省思提問' : '已略過駐馬省思提問');
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
