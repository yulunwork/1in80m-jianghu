// 《江湖蒼生錄 · 八千萬眾》主程式邏輯（獨創武俠案頭、全景沙盤與對開古籍版面）

(function () {
  const DATA = window.JIANGHU_DATA;

  const cfg = {
    era: 'any',
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

  function pickHumorDeathCause(region, age) {
    const hc = DATA.HUMOR_DEATH_CAUSES;
    if (!hc) return pick(region.causes);
    if (age <= 5) return pick(hc.infant);
    const le = region.leM || 45;
    if (age >= le + 10) return pick(hc.oldAge);
    if (region.zone === '名門世家') return pick(hc.elite);
    if (region.zone === '江湖底層') return pick(hc.fringe);
    return pick(hc.mortal);
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
      const deathCause = pickHumorDeathCause(region, deathAge);

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
      eraKey = pick(['north_song', 'south_song', 'yuan_ming', 'qing_jianghu']);
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
      castrated: false,
      blindBoxCount: 0,
      mishapCount: 0,
      lastBoxReport: null,
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
      usedMishaps: {},
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
        addFeedLog(age, `入冬時染上一場風寒高熱，母親聽信赤腳大夫偏方餵你喝了半碗香灰水，竟奇蹟般退燒了。`, `古代小兒冬季傷寒染病率 34%`, 'bad');
      }
      return;
    }

    if (life.stats.martial >= 18 && life.topArt === '無' && Math.random() < 0.45) {
      life.topArt = pick(r.artsPool);
      setBadge('武');
      addFeedLog(age, `經過日夜苦練，你終於領悟了「${life.topArt}」的精要，在村口打狗時再也沒輸過！`, `武學修習突破率 · 當前武學 ${Math.round(life.stats.martial)}`, 'ms');
      return;
    }

    if (life.family.spouse && !life.castrated && life.family.spouse.alive && age >= 20 && age <= 42 && life.family.children.length < 4 && Math.random() < 0.22) {
      const cSex = Math.random() < 0.5 ? 'F' : 'M';
      const cName = genName(r, cSex);
      life.family.children.push({ name: cName, sex: cSex, birthAge: age });
      life.stats.mind = clamp(life.stats.mind + 8);
      life.stats.bonds = clamp(life.stats.bonds + 8);
      setBadge('子');
      addFeedLog(age, `家中添丁之喜！伴侶為你誕下一${cSex === 'F' ? '女' : '子'}，取名「${cName}」。`, `大宋戶部生育統計 · 血脈延續`, 'ms');
      return;
    }

    // 方案一：38% 機率觸發「大俠打架我買單 / 十四天書路人甲荒謬際遇」（同生不重複）
    if (DATA.NPC_MISHAPS && roll < 0.38) {
      life.usedMishaps = life.usedMishaps || {};
      const unused = DATA.NPC_MISHAPS.filter((_, idx) => !life.usedMishaps[idx]);
      const pool = unused.length > 0 ? unused : DATA.NPC_MISHAPS;
      const m = pick(pool);
      const mIdx = DATA.NPC_MISHAPS.indexOf(m);
      if (mIdx >= 0) life.usedMishaps[mIdx] = true;

      const fx = m.fx || {};
      if (fx.health)  life.stats.health  = clamp(life.stats.health + fx.health);
      if (fx.mind)    life.stats.mind    = clamp(life.stats.mind + fx.mind);
      if (fx.martial) life.stats.martial = clamp(life.stats.martial + fx.martial);
      if (fx.bonds)   life.stats.bonds   = clamp(life.stats.bonds + fx.bonds);
      if (fx.silver)  life.silver        = Math.max(0, Math.round((life.silver + fx.silver) * 10) / 10);
      life.mishapCount = (life.mishapCount || 0) + 1;
      if (m.badge) setBadge(m.badge);
      addFeedLog(age, m.text, m.note, m.type || '');
      return;
    }

    if (roll < 0.48) {
      const bonus = Math.round(r.incomeSilver * 0.4 * 10) / 10;
      life.silver = Math.round((life.silver + bonus) * 10) / 10;
      life.stats.mind = clamp(life.stats.mind + 4);
      addFeedLog(age, `今年風調雨順，又沒有大俠經過拆毀街坊，市集買賣興隆，手頭多攢下了 ${bonus} 兩紋銀。`, `地方歲收豐歉波動 · 歲入穩定`);
    } else if (roll < 0.60) {
      life.stats.health = clamp(life.stats.health - 6);
      life.silver = Math.max(0, Math.round((life.silver - 2) * 10) / 10);
      addFeedLog(age, `夏秋之交疫癘與旱情蔓延，只得節衣縮食、抓藥調理身體。`, `地方州縣災荒發生率 ${Math.round(r.warRisk * 0.8)}%`, 'bad');
    } else if (roll < 0.72 && (life.focus === 'outer' || life.focus === 'inner' || life.stats.martial >= 25)) {
      life.stats.martial = clamp(life.stats.martial + 3.5);
      addFeedLog(age, `於渡口茶肆偶遇一名遊方武師，雙方商業互吹並切磋數招，對「${life.topArt !== '無' ? life.topArt : r.artsPool[0]}」頗有進益。`, `江湖同道切磋勝率 · 武學 ${Math.round(life.stats.martial)}`);
    } else if (roll < 0.82) {
      life.stats.bonds = clamp(life.stats.bonds + 3);
      addFeedLog(age, `中秋月圓之夜，與鄰里分食月餅、聽茶館說書人瞎編五絕大俠的八卦緋聞。`, `常年道心安定指數 · 心境 ${Math.round(life.stats.mind)}`);
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
          cause: pickHumorDeathCause(r, age),
          statNote: `${r.name} 五歲以下夭折率 ${r.u5Mort}% · 戶部與歷史生命表模型`
        };
      }
    }

    if (life.stats.health <= 2) {
      return {
        died: true,
        cause: life.castrated
          ? '自宮傷口反覆感染，加上氣血枯竭含恨而終'
          : '長期被江湖二手掌風震傷內腑，氣血枯竭而亡',
        statNote: `體魄降至臨界值 · 缺醫少藥環境致死率 92%`
      };
    }

    const hazardBase = (r.warRisk * life.eraObj.warMod + (life.focus === 'chivalry' ? r.feudRisk * 1.4 : r.feudRisk * 0.5)) / 2200;
    if (age >= 15 && Math.random() < hazardBase) {
      if (life.stats.martial >= 60 && Math.random() < 0.72) {
        life.stats.health = clamp(life.stats.health - 12);
        addFeedLog(age, `遭逢強敵與兵禍伏擊，幸賴一身深厚武學（${life.topArt}）浴血殺出重圍，僅受皮肉之傷！`, `高階武學化險為夷機率 72%`, 'ms');
      } else {
        const c = pickHumorDeathCause(r, age);
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
          cause: age >= le ? pick(DATA.HUMOR_DEATH_CAUSES.oldAge) : pickHumorDeathCause(r, age),
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
    if (fx.passiveIncome) {
      life.passiveIncome += fx.passiveIncome;
      life.sect = '日月神教 · 口號氣氛組';
      life.topArt = '文成武德馬屁功';
    }

    let extraNote = '';
    if (fx.joinSect) {
      life.sect = pick(life.region.sectPool);
      life.topArt = pick(life.region.artsPool);
      life.family.master = { name: pick(DATA.SURNAMES) + '師父', alive: true };
      extraNote = `（正式拜入「${life.sect}」，獲傳「${life.topArt}」）`;
    }
    if (fx.stealDuck) {
      if (Math.random() < 0.62) {
        life.stats.health = clamp(life.stats.health + 12);
        life.silver = Math.round((life.silver + 6) * 10) / 10;
        extraNote = `（大俠忙著對掌沒空理你，你白嫖了一隻脆皮烤鴨與 6 兩酒錢！）`;
      } else {
        life.stats.health = clamp(life.stats.health - 20);
        extraNote = `（手剛碰到鴨屁股就被掌風震飛出二樓窗外，體魄 -20，但懷裡死死護住了半隻鴨腿！）`;
      }
    }
    if (fx.tauntHeroes) {
      life.stats.bonds = clamp(life.stats.bonds + 22);
      life.stats.martial = clamp(life.stats.martial + 10);
      if (life.stats.martial >= 55) {
        extraNote = `（兩大高手被你的霸氣鎮住，竟雙雙抱拳道了一聲「閣下深藏不露」！）`;
      } else {
        life.stats.health = clamp(life.stats.health - 28);
        extraNote = `（兩大高手同時停手把你揍成豬頭再繼續決鬥，體魄 -28，但你在全鎮吹了二十年牛！）`;
      }
    }
    if (fx.gambleManual) {
      if (Math.random() < 0.68 || life.stats.martial >= 30) {
        life.stats.martial = clamp(life.stats.martial + 22);
        life.topArt = pick(life.region.artsPool);
        extraNote = `（奇遇大成！雖然髮際線後退了兩寸，但貫通任督二脈，武學暴漲 +22！）`;
      } else {
        life.stats.health = clamp(life.stats.health - 18);
        life.stats.martial = clamp(life.stats.martial + 6);
        extraNote = `（真氣逆行嘔血，體魄受創 -18，頭髮還掉了一大把，幸保住性命）`;
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
        extraNote = `（寡不敵眾被揍成豬頭 -20，幸得路過義士接應脫險）`;
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
        extraNote = `（血戰中身受重創 -26，靠裝死躲在死人堆裡逃過一劫）`;
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

  // ==================== 方案二：鬼市地攤盲盒鑑定 ＆ 九州坊市 ====================
  function rollBlindBoxLoot(weights) {
    const total = (weights.N || 0) + (weights.R || 0) + (weights.SR || 0) + (weights.SSR || 0);
    let r = Math.random() * total;
    let chosenTier = 'N';
    for (const k of ['SSR', 'SR', 'R', 'N']) {
      const w = weights[k] || 0;
      if (r < w) {
        chosenTier = k;
        break;
      }
      r -= w;
    }
    const pool = DATA.BLIND_BOX_POOL[chosenTier] || DATA.BLIND_BOX_POOL.N;
    return pick(pool);
  }

  function openShopModal() {
    if (!life || !life.alive) return;
    const wasPaused = paused;
    paused = true;
    updateSpeedUI();

    const modal = $('modal');
    modal.hidden = false;

    function renderShopContent() {
      const rep = life.lastBoxReport;
      const repColors = {
        N:   { border: '#7A6E5D', bg: 'rgba(122,110,93,0.12)', badge: '#6E6050' },
        R:   { border: '#245C4E', bg: 'rgba(36,92,78,0.12)',   badge: '#245C4E' },
        SR:  { border: '#8C6224', bg: 'rgba(140,98,36,0.15)',  badge: '#8C6224' },
        SSR: { border: '#9E2424', bg: 'rgba(158,36,36,0.16)',  badge: '#9E2424' }
      };
      const rc = rep ? (repColors[rep.rarity] || repColors.N) : null;

      modal.innerHTML = `
        <div class="dec" style="width:min(760px,100%)" role="dialog" aria-modal="true">
          <div class="hd">
            <span>【🏮 鬼市地攤盲盒 ＆ 九州正經坊市】</span>
            <span>行囊盤纏：<b>${life.silver.toFixed(1)} 兩紋銀</b></span>
          </div>
          <div class="bd" style="max-height:78vh;overflow-y:auto">
            ${rep ? `
              <div style="border:2px solid ${rc.border};background:${rc.bg};padding:12px 16px;margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <b style="font-family:var(--f-display);font-size:17px;color:var(--ink)">📜 鬼市開盒鑑定：${rep.name}</b>
                  <span style="background:${rc.badge};color:#FDF8EE;padding:2px 8px;font-size:12px;font-family:var(--f-display)">${rep.rarityLabel}</span>
                </div>
                <p style="margin:0;font-size:13.5px;color:var(--ink)">${rep.report}</p>
              </div>
            ` : ''}

            <h2 style="font-size:19px;margin-bottom:4px">🎲 鬼市地攤 · 泛黃秘笈與神丹盲盒（買定離手，死傷自負）</h2>
            <p style="font-size:13px;margin-bottom:10px">九成九的江湖人一輩子沒見過真絕學，但地攤老闆發誓他這包真的是從少林寺偷出來的：</p>
            <div class="ch" style="margin-bottom:18px">
              ${(DATA.BLIND_BOX_TIERS || []).map((box, bidx) => {
                const canBuy = life.silver >= box.cost;
                return `
                  <button type="button" class="${canBuy ? '' : 'lock'}" data-bidx="${bidx}" ${canBuy ? '' : 'disabled'} style="border-color:var(--accent)">
                    <span class="k" style="background:var(--accent);color:#FDF8EE">${box.cost}兩</span>
                    <b>${box.name} <span class="seal-stamp" style="margin-left:6px;font-size:11px">${box.tag}</span></b>
                    <small>${box.desc}</small>
                  </button>
                `;
              }).join('')}
            </div>

            <h2 style="font-size:18px;margin-bottom:4px;border-top:1px dashed var(--rule);padding-top:12px">🏪 正經坊市 · 藥鋪、鐵匠鋪與田契牙行</h2>
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
              <button type="button" class="ghost sm" id="shopCloseBtn">收好荷包 · 離開坊市</button>
            </div>
          </div>
        </div>
      `;

      $('shopCloseBtn').addEventListener('click', () => {
        modal.hidden = true;
        paused = wasPaused;
        updateSpeedUI();
      });

      // 購買鬼市秘笈盲盒
      modal.querySelectorAll('.ch button[data-bidx]:not(.lock)').forEach((btn) => {
        btn.addEventListener('click', () => {
          const box = DATA.BLIND_BOX_TIERS[Number(btn.dataset.bidx)];
          if (!box || life.silver < box.cost) return;
          life.silver = Math.max(0, Math.round((life.silver - box.cost) * 10) / 10);
          life.blindBoxCount = (life.blindBoxCount || 0) + 1;

          const loot = rollBlindBoxLoot(box.weights);
          const fx = loot.fx || {};
          if (fx.health)  life.stats.health  = clamp(life.stats.health + fx.health);
          if (fx.mind)    life.stats.mind    = clamp(life.stats.mind + fx.mind);
          if (fx.martial) life.stats.martial = clamp(life.stats.martial + fx.martial);
          if (fx.bonds)   life.stats.bonds   = clamp(life.stats.bonds + fx.bonds);
          if (fx.silver)  life.silver        = Math.max(0, Math.round((life.silver + fx.silver) * 10) / 10);
          if (fx.passiveIncome) life.passiveIncome += fx.passiveIncome;
          if (fx.castrated) life.castrated = true;
          if (fx.topArt) life.topArt = fx.topArt;
          if (fx.weapon) life.weapon = fx.weapon;

          life.lastBoxReport = loot;
          if (life.grid.length) {
            life.grid[life.grid.length - 1].badge = loot.rarity === 'SSR' ? '神' : (loot.rarity === 'N' ? '坑' : '奇');
          }

          addFeedLog(
            life.age,
            `【鬼市開盒】耗銀 ${box.cost} 兩買下${box.name}，拆開竟是${loot.rarityLabel}${loot.name}——${loot.report}`,
            `鬼市盲盒第 ${life.blindBoxCount} 抽 · 餘銀 ${life.silver.toFixed(1)} 兩`,
            loot.rarity === 'N' ? 'bad' : 'ms'
          );
          showToast(`開盒結果：${loot.rarityLabel} ${loot.name}`);
          updateAllLifePanels();
          renderShopContent();
        });
      });

      // 購買正經坊市商品
      modal.querySelectorAll('.ch button[data-sidx]:not(.lock)').forEach((btn) => {
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

  // ==================== 方案四：百曉生毒舌評語 ＆ 江湖奇葩外號生成器（42種稱號池＋跨局防重複） ====================
  function evaluateJianghuEpithet(l) {
    const m = l.stats.martial;
    const age = l.age;
    const sil = l.silver;
    const kids = l.family.children ? l.family.children.length : 0;
    const cause = l.deathCause || '';
    const art = l.topArt || '';
    const mishaps = l.mishapCount || 0;
    const boxes = l.blindBoxCount || 0;

    // 讀取最近 10 局已出現過的外號，避免連續幾局都看到同一個評論
    let recentTitles = [];
    try {
      recentTitles = JSON.parse(localStorage.getItem('jianghu_recent_epithets_v1') || '[]');
    } catch (_) {
      recentTitles = [];
    }

    const candidates = [];
    const addCand = (tier, rarity, rarityLabel, color, title, roast) => {
      candidates.push({ tier, rarity, rarityLabel, color, title, roast });
    };

    // ── 1. 幼年速通池（5歲以下夭折專屬，3種輪替） ──
    if (age <= 5) {
      addCand(4, 'N', 'N · 速通玩家', '#9C8D78', '【奈何橋孟婆湯續杯VIP】',
        '別人在江湖快意恩仇，你在陰曹地府折返跑。上一碗孟婆湯都還沒消化完，你就又排進了投胎隊伍，堪稱人間一日遊體驗卡持有者。');
      addCand(4, 'N', 'N · 投胎速通', '#9C8D78', '【地府搖號系統壓力測試員】',
        '連新手村的門檻都還沒邁過去就觸發了全劇終。黑白無常看到你的名字都愣住了：「這小子怎麼五分鐘前剛送走又回來了？」');
      addCand(4, 'N', 'N · 落地成盒', '#9C8D78', '【連自己名字都還不會寫的過客】',
        '大俠們還在娘胎裡練先天胎息，你卻因為接生婆跟赤腳大夫的不靠譜操作直接重開。下輩子投胎記得先看準接生婆有沒有洗手！');
    } else {
      // ── 2. 特殊功法與自宮專屬池（Tier 3） ──
      if (l.castrated) {
        if (m >= 58) {
          addCand(3, 'SSR', 'SSR · 絕世狠人', '#E0665A', '【威震武林的九千歲廠公】',
            '別人練劍要錢，你練劍要命根子。雖然武功蓋世、繡花針下無一合之敵，但每逢夜深人靜上茅房時，總免不了蹲著流下兩行清淚。');
          addCand(3, 'SSR', 'SSR · 紅塵斬斷', '#E0665A', '【東方教主座下首席刺繡宗師】',
            '自從揮刀斬斷塵緣後，你不僅劍法快如鬼魅，連十字繡跟納鞋底的手藝都冠絕武林。正道大俠打不過你，連罵街都沒你聲音尖！');
        } else {
          addCand(3, 'R', 'R · 江湖大冤種', '#D4A359', '【白挨一刀的絕後冤大頭】',
            '刀也揮了、痛也挨了，結果發現買到的是地攤盜版食譜。武功沒練成還斷了老家香火，連閻王爺翻開生死簿都忍不住笑出聲。');
          addCand(3, 'R', 'R · 痛失所愛', '#D4A359', '【拿命根子換切菜刀法的苦主】',
            '林平之自宮好歹報了滅門之仇，你自宮卻只學會了如何把滷牛肉切得薄如蟬翼。這波投資報酬率堪稱大宋股市最大慘案。');
        }
      }

      if (art.includes('太玄經')) {
        addCand(3, 'UR', 'UR · 文盲天尊', '#F5C451', '【靠不識字練成神功的文盲奇才】',
          '滿島老學究皓首窮經都參不透的蝌蚪文，你因為壓根沒上過私塾、把它當成麵條跟蚯蚓看，居然誤打誤撞神功大成！沒文化在俠客島真是無敵。');
      }
      if (art.includes('蛤蟆')) {
        addCand(3, 'SR', 'SR · 奇門異獸', '#D4A359', '【村口趴著呱呱叫的狠人】',
          '掌力確實剛猛無儔，唯一遺憾是每次對敵前都得趴在泥地上鼓腮幫子學青蛙叫。死後方圓十里的野狗跟蟾蜍都來替你送行。');
      }
      if (art.includes('躺屍') || art.includes('滾動') || art.includes('抹油')) {
        addCand(3, 'SR', 'SR · 苟命宗師', '#D4A359', '【躺平翻滾界的武學泰斗】',
          '別人練武講究氣吞山河，你練武講究「只要我躺得夠快、滾得夠圓，敵人的刀就追不上我」。姿勢雖然毫無尊嚴，但能多苟活幾年就是真本事。');
      }
      if (art.includes('野球拳')) {
        addCand(3, 'UR', 'UR · 異界蝦米', '#F5C451', '【靠剪刀石頭布打穿武林的拳聖】',
          '別人出招是降龍十八掌，你出招是「剪刀、石頭、布」！偏偏練到第十層後一拳轟碎半座華山，五絕高手死前都還在納悶你下一拳到底出布還是出石頭。');
      }
      if (art.includes('化屍') || art.includes('搓背') || art.includes('馬屁')) {
        addCand(3, 'SR', 'SR · 三百六十行', '#D4A359', '【把絕世武功拿去搞副業的奇才】',
          '別人學武是為了華山論劍，你學武是用來通馬桶、去澡堂搓背、在魔教喊口號領雙薪。可謂全江湖最懂「技術變現」的務實派大師！');
      }
      if (art.includes('神照') || art.includes('九陰') || art.includes('九陽') || art.includes('降龍') || art.includes('獨孤') || art.includes('六脈')) {
        addCand(3, 'SSR', 'SSR · 天選傳人', '#E0665A', '【地攤淘寶居然淘到真跡的歐皇】',
          '別人去鬼市買十本有十本是太監食譜，你隨手一掏居然摸出鎮派神功真跡！百曉生嚴重懷疑你是不是偷偷塞紅包給了遊戲企劃。');
      }

      // ── 3. 生平數值與際遇特色池（Tier 2） ──
      if (m >= 84 && age >= 45) {
        addCand(3, 'UR', 'UR · 天道破格', '#F5C451', '【橫壓一世的六邊形真宗師】',
          '在八千萬分之一的泥沼開局裡硬生生逆天改命！百曉生翻遍了整本毒舌詞庫也沒找到黑點，只能雙手抱拳跪喊一聲：老前輩牛逼！');
        addCand(3, 'UR', 'UR · 隱藏五絕', '#F5C451', '【金庸老先生寫漏了名字的第六絕】',
          '東邪西毒南帝北丐見了你都得客客氣氣讓座，掃地僧路過都要向你請教保養膝蓋的秘方。唯一缺點是太低調，沒能混進小說書名裡。');
      }

      if (boxes >= 3 && m < 52) {
        addCand(2, 'R', 'R · 慈善賭王', '#4DA892', '【鬼市地攤防詐反面教材】',
          '全江湖的盜版秘笈跟山羊糞丸子都被你一個人包圓了。你下葬那天，鬼市地攤老闆哭得比你親生兒子還傷心，因為痛失了全年度最大金主。');
        addCand(2, 'R', 'R · 盲盒成癮', '#4DA892', '【堅信下一盒必出九陽神功的賭徒】',
          '一輩子省吃儉用攢下的血汗銀子，全拿去換了地攤老頭用草紙印的假秘笈。家裡墊桌腳的假書堆得比少林寺藏經閣還高！');
      }

      if (mishaps >= 4) {
        addCand(2, 'SR', 'SR · 吸禍體質', '#D4A359', '【全江湖大俠指定拆遷受災戶】',
          '你這輩子簡直自帶「百分百偶遇主角打架」雷達！去洛陽吃麵遇到喬峰掀桌，去終南山砍柴被全真教道士踹翻雞籠，活到這麼大純屬命硬。');
        addCand(2, 'R', 'R · 災星轉世', '#4DA892', '【出門買顆白菜都能遇上滅門案的衰神】',
          '不管你搬家到哪個州府，不到三個月必定有正邪兩派在你家屋頂決一死戰。街坊鄰居看到你買房都連夜搬走，堪稱古代房價冥燈！');
      }

      if (m >= 65 && sil < 6) {
        addCand(2, 'SR', 'SR · 窮鬼宗師', '#D4A359', '【身懷絕世神功的要飯鬼】',
          '一身內力震古鑠今，結果全身上下掏不出半文銅錢買燒餅。你用親身經歷向世人證明：就算練成絕世武功，不打工一樣要餓死街頭。');
      }

      if ((sil >= 85 || l.passiveIncome >= 14) && m < 45) {
        addCand(2, 'SR', 'SR · 鈔能力者', '#D4A359', '【用銀票砸死大俠的土財主】',
          '武功再高，也怕菜刀；內力再深，見錢眼開。你一輩子懶得練拳，卻靠著收租與銀兩讓無數江湖好漢乖乖幫你看家護院。');
        addCand(2, 'SR', 'SR · 餐飲金主', '#D4A359', '【襄陽城最大酒樓桌椅維修贊助商】',
          '大俠們負責在酒樓一言不合掀桌子，你負責在背後壟斷全城的木匠鋪與跌打損傷藥鋪，把江湖恩怨變成了你穩賺不賠的搖錢樹！');
      }

      if (age >= 65 && m < 32) {
        addCand(2, 'SSR', 'SSR · 苟道至尊', '#E0665A', '【苟到全書大結局的活化石】',
          '打架你先跑、熱鬧你不看、客棧永遠坐離大門最近那桌。當年叱吒風雲的大俠墳頭草都三丈高了，你還在村口曬著太陽剔牙。');
        addCand(2, 'SR', 'SR · 長壽順民', '#D4A359', '【把五絕高手全都熬死吃席的養生大師】',
          '別人靠九陽真經續命，你靠早睡早起、絕不多管閒事續命。一生參加過三十八位江湖大俠的追悼會，每次去都坐小孩那桌狂打包紅燒肉。');
      }

      if (kids >= 3) {
        addCand(2, 'SR', 'SR · 人口功臣', '#D4A359', '【朝廷戶部認證人肉播種機】',
          '什麼華山論劍、九陰真經與你毫無關係。你在自家炕頭上的戰績遠勝江湖豪傑，憑一己之力扛起了整個州縣的人口增長指標。');
      }

      // ── 4. 死因專屬地獄梗池（Tier 2，依不同死因精準吐槽，不再全部塞進同一個背景板！） ──
      if (/喬峰|聚賢莊|牌匾|碗筷|酒樓/.test(cause)) {
        addCand(2, 'R', 'R · 氣氛耗材', '#4DA892', '【酒樓大俠裝逼專用人肉背景板】',
          '主角們在書裡負責瀟灑帥氣、不付酒錢，而你負責在背景裡連人帶碗飛出三條街，用寶貴的生命為大俠的降龍掌風提供震撼視覺特效。');
      }
      if (/梅超風|李莫愁|玉蜂|東方不敗|繡花針|瓦耳拉齊|暗器|飛刀|流矢/.test(cause)) {
        addCand(2, 'R', 'R · 百分百接鏢', '#4DA892', '【用臉幫主角擋暗器的無名替死鬼】',
          '反派隨手亂甩的一記暗器，穿過八條街精準命中了正在路邊摳腳的你。暗器準頭沒怎麼樣，但你接暗器的走位堪稱百發百中！');
      }
      if (/星宿|鼓掌|天地會|六大派|血刀|成崑|謝遜|金輪法王/.test(cause)) {
        addCand(2, 'R', 'R · 門派砲灰', '#4DA892', '【正邪大火拼裡連姓名都沒有的群演】',
          '出門前以為只是去湊個熱鬧喊兩句口號，結果正邪兩派大招齊發，你連敵人的衣角都沒摸到就成了少林寺門口的一具無名業績。');
      }
      if (/韋小寶|蒙汗藥|石灰|田伯光|胡斐|鳳天南/.test(cause)) {
        addCand(2, 'R', 'R · 江湖苦主', '#4DA892', '【被不講武德的主角坑死的倒楣蛋】',
          '說好的江湖規矩單打獨鬥呢？你萬萬沒想到這年頭連大俠都隨身攜帶生石灰粉與蒙汗藥，死前最後一個念頭是：這傢伙比反派還髒！');
      }
      if (/臘八粥|金波旬花|斷腸草|附子|試藥|蛤蟆|逆運|走火入魔|丹/.test(cause)) {
        addCand(2, 'R', 'R · 絕命試藥員', '#4DA892', '【神農嚐百草卻把自己毒死的狠人】',
          '別人奇遇吃下朱果是功力大增，你隨便在路邊撿顆野果或喝碗粥就直接見了太奶。李時珍寫《本草綱目》都得在序言裡感謝你的犧牲！');
      }
      if (/胡一刀|說書|太師椅|重孫|吃席|雞腿|廣場舞|九十九/.test(cause)) {
        addCand(2, 'SR', 'SR · 吃瓜仙翁', '#D4A359', '【為小說結局死不瞑目的資深吃瓜群眾】',
          '躲過了戰亂、飢荒與大俠拆遷，最後卻在太師椅上因為茶館說書人斷章狗血劇情氣絕身亡。這份對八卦的執念連閻王爺都敬你三分！');
      }

      // ── 5. 通用流派與人生軌跡池（Tier 1，確保任何玩法都有豐富變化） ──
      if (!l.family.spouse && age >= 32) {
        addCand(1, 'R', 'R · 孤狼劍客', '#4DA892', '【憑實力單身的紅塵絕緣體】',
          '心中無男女，拔劍自然神。你成功避開了所有紅塵情劫與彩禮開銷，把一輩子的溫柔都獻給了手裡的農具與鐵劍。');
        addCand(1, 'R', 'R · 絕情谷主', '#4DA892', '【連絕情谷情花見了都枯萎的鐵石心腸】',
          '楊過跟小龍女愛得死去活來，你卻覺得談戀愛還不如在家多砍兩擔柴。月老拿鋼絲給你牽紅線都被你一剪刀剪斷拿去穿魚了！');
      }

      if (m >= 38) {
        addCand(1, 'R', 'R · 江湖莽夫', '#4DA892', '【一言不合就掀桌的狠角色】',
          '半生提刀走江湖，砍翻過幾個不長眼的小流氓，也挨過幾頓社會毒打。雖未名列五絕，倒也算沒白來這腥風血雨的人間瀟灑一回。');
        addCand(1, 'R', 'R · 十里拳霸', '#4DA892', '【稱霸村口十里八鄉的街頭武聖】',
          '打不過五絕宗師，但揍翻村口惡霸跟偷雞摸狗之輩綽綽有餘。十里八鄉的野狗看到你提著棍子出門都得夾著尾巴繞道走！');
        addCand(1, 'R', 'R · 刀口舔血', '#4DA892', '【把腦袋別在褲腰帶上的江湖老油條】',
          '走過南闖過北，挨過毒針也喝過假酒。雖然沒能混成開宗立派的大宗師，但憑著一身紮實把式，硬是在亂世裡殺出了一條血路。');
      }

      if (l.stats.bonds >= 75) {
        addCand(1, 'R', 'R · 義薄雲天', '#4DA892', '【全鎮紅白喜事隨禮第一名的孟嘗君】',
          '武功高不高無所謂，但全鎮誰家嫁女兒、誰家老母豬難產都有你幫忙的身影。出殯那天半個縣城的百姓都來替你哭喪，排場堪比武林盟主！');
      }

      // 保底芸芸眾生池（Tier 0，4種輪替）
      addCand(0, 'N', 'N · 芸芸眾生', '#9C8D78', '【湊齊八千萬分之一的背景板】',
        '不曾見過少林武當的絕頂風景，也沒買到過逆天改命的真秘笈。你就像黃河岸邊的一株野麥，在雞毛蒜皮與鹹菜白粥裡走完了真實的一生。');
      addCand(0, 'N', 'N · 種田宗師', '#9C8D78', '【在武俠世界堅持種田的硬核農夫】',
        '不管外面是蒙古鐵騎叩關還是六大派圍攻光明頂，你心裡只有自家那兩畝水田的收成。大俠們拯救天下，而你種出的糧食養活了大俠。');
      addCand(0, 'N', 'N · 人間清醒', '#9C8D78', '【一眼看穿江湖騙局的摸魚達人】',
        '什麼武林盟主、天下第一，在你眼裡全是不給工錢的傳銷畫餅。你一輩子不練功、不拜師、不看熱鬧，堪稱整部金庸小說裡最清醒的正常人。');
      addCand(0, 'N', 'N · 煙火凡人', '#9C8D78', '【用柴米油鹽寫完一生的無名小卒】',
        '沒有跌宕起伏的奇遇，也沒有刻骨銘心的仇殺。你在人間留下的唯一痕跡，是縣衙黃冊上的一行墨字，以及老屋灶台上升起過的萬千炊煙。');
    }

    // 優先過濾掉最近 10 局已經看過的外號，保證每次結局都有新鮮感
    let freshPool = candidates.filter((c) => !recentTitles.includes(c.title));
    if (freshPool.length === 0) {
      freshPool = candidates;
    }

    // 在可用候選池中，取最高優先級 (tier) 或次高優先級進行隨機抽取
    const maxTier = Math.max(...freshPool.map((c) => c.tier));
    const topCands = freshPool.filter((c) => c.tier >= Math.max(1, maxTier - 1));
    const chosen = pick(topCands.length ? topCands : freshPool);

    // 記錄本次抽中的外號至 localStorage（保留最近 10 筆）
    try {
      const updated = [chosen.title, ...recentTitles.filter((t) => t !== chosen.title)].slice(0, 10);
      localStorage.setItem('jianghu_recent_epithets_v1', JSON.stringify(updated));
    } catch (_) {}

    return chosen;
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
    const ep = evaluateJianghuEpithet(life);
    life.epithet = ep;

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

    // 全新三欄式「中軸石碑（含百曉生毒舌封號榜）＋ 左右雙翼列傳」版面配置
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

        <!-- 中央矗立：石碑拓印本傳 ＋ 百曉生毒舌封號牌 -->
        <div class="stele-center">
          <div class="stele-head">百曉生武林譜 · 第 ${life.serial} 卷</div>
          <div style="font-size:13px;color:#B5A792">${life.eraObj.name}（${life.birthYear}–${life.birthYear + life.age}）</div>
          <h1 class="stele-title">故 ${life.name} 之碑</h1>
          <div><span class="seal-stamp" style="color:#E0665A;border-color:#E0665A">${realm.name} · 享年 ${life.age} 歲</span></div>
          <div class="stele-cause">終局：${life.deathCause}</div>

          <!-- 方案四：百曉生蓋棺奇葩外號與毒舌評語盒 -->
          <div style="margin:14px 0;padding:14px 16px;background:rgba(212,163,89,0.1);border:2px solid ${ep.color};text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:12px;color:#D4A359;letter-spacing:0.12em">🪪 百曉生蓋棺認證外號</span>
              <span style="background:${ep.color};color:#161311;font-weight:900;font-size:11.5px;padding:2px 8px;font-family:var(--f-mono)">${ep.rarityLabel}</span>
            </div>
            <div style="font-family:var(--f-display);font-size:22px;font-weight:700;color:#FDF8EE;margin-bottom:6px">${ep.title}</div>
            <p style="margin:0;font-size:13.5px;color:#DFD5C2;line-height:1.6"><b>毒舌銳評：</b>「${ep.roast}」</p>
          </div>

          <div class="stele-bio">
            <b>太史公考據：</b>${life.name}者，${r.name.split(' · ')[0]}人氏，生於${life.familyTier}。生平歷 ${life.age} 載寒暑，終老時名列「<b>${life.sect}</b>」，武學修為臻至「<b>${realm.name}</b>」（絕藝：${life.topArt}）。
            生平共遭大俠波及 <b>${life.mishapCount || 0}</b> 次、於鬼市開盲盒 <b>${life.blindBoxCount || 0}</b> 次。同歲降生於當地之孩童，僅 <b>${survAtDeath}%</b> 能活至此壽數。
          </div>

          <div class="stele-metrics">
            <div><small>籍貫門第 (比重 ${life.birthProb.toFixed(2)}%)</small><b>${r.name}</b></div>
            <div><small>隨身絕藝與配刃</small><b>${life.topArt} · ${life.weapon}</b></div>
            <div><small>身後遺留盤纏</small><b>紋銀 ${life.silver.toFixed(1)} 兩</b></div>
            <div><small>紅塵家室</small><b>${life.family.spouse ? `${life.family.spouse.name} (${life.family.children.length}子嗣)` : '孤身未娶/未嫁'}</b></div>
          </div>

          <div style="text-align:left;margin-top:14px">
            <label for="fwInput" style="font-size:12px;color:#D4A359;display:block;margin-bottom:4px">銘刻石碑墓誌銘（將連同外號立碑於首頁「忠烈碑林」）：</label>
            <textarea id="fwInput" rows="2" style="width:100%;background:#12100E;color:#EAE0CC;border:1px solid #5C4932;padding:8px;font:inherit;font-size:13.5px" placeholder="如：下輩子投胎絕不去洛陽酒樓端菜了..."></textarea>
            <button type="button" class="cta sm" id="saveMemoBtn" style="width:100%;margin-top:6px">銘刻立碑入祠</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;margin-top:18px;padding-top:16px;border-top:1px dashed rgba(212,163,89,0.3)">
            <button type="button" class="cta" id="rebirthBtn">【再入江湖輪迴（重新落子）】</button>
            <div style="display:flex;gap:8px">
              <button type="button" class="ghost sm" id="shareDeadCardBtn" style="flex:1;background:#2A231B;color:#EAE0CC">下載「百曉生懸賞鑑定卡」</button>
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
      const q = $('fwInput').value.trim() || ep.roast;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem('jh_memorials') || '[]');
      } catch (e) {}
      saved.unshift({
        name: life.name,
        span: `${life.birthYear}–${life.birthYear + life.age} · 享年${life.age}歲`,
        origin: r.name,
        realm: `${getRealm(life.stats.martial).name} · ${ep.title}`,
        cause: life.deathCause,
        quote: q,
        incense: 1
      });
      localStorage.setItem('jh_memorials', JSON.stringify(saved.slice(0, 20)));
      $('saveMemoBtn').disabled = true;
      $('saveMemoBtn').textContent = '已立碑入祠';
      showToast('已將墓誌銘與江湖外號立碑於首頁「忠烈碑林」！');
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
    const ep = evaluateJianghuEpithet(life);
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
      sect: `${life.sect} ${ep.title}`,
      realm: getRealm(life.stats.martial).name,
      deathCause: life.deathCause
    });
    localStorage.setItem('jh_past_lives', JSON.stringify(past.slice(0, 30)));
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = Array.from(text);
    let line = '';
    let curY = y;
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, curY);
        line = chars[i];
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, curY);
    return curY;
  }

  function exportShareCard(isDead = false) {
    if (!life) return;
    const cv = document.createElement('canvas');
    cv.width = 760;
    cv.height = 480;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#F6F0E0';
    ctx.fillRect(0, 0, 760, 480);
    ctx.strokeStyle = '#8C6224';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 736, 456);
    ctx.lineWidth = 1;
    ctx.strokeRect(17, 17, 726, 446);

    ctx.fillStyle = isDead ? '#1F1A16' : '#4A3728';
    ctx.fillRect(18, 18, 724, 54);

    ctx.fillStyle = '#F5E8C7';
    ctx.font = 'bold 21px "Noto Serif TC", serif';
    ctx.fillText(isDead ? '《江湖蒼生錄 · 百曉生蓋棺鑑定懸賞令》' : '《江湖蒼生錄 · 官府出生戶帖》', 30, 52);
    ctx.font = '13px "Noto Serif TC", serif';
    ctx.fillText(`卷宗字號 第 ${life.serial} 號`, 570, 51);

    if (isDead) {
      const ep = life.epithet || evaluateJianghuEpithet(life);
      // 稀有度標籤與外號大字
      ctx.fillStyle = '#9E2424';
      ctx.fillRect(32, 88, 130, 28);
      ctx.fillStyle = '#FDF8EE';
      ctx.font = 'bold 14px "Noto Serif TC", serif';
      ctx.fillText(ep.rarityLabel, 42, 107);

      ctx.fillStyle = '#1C1814';
      ctx.font = 'bold 30px "Noto Serif TC", serif';
      ctx.fillText(`${life.name}（享年 ${life.age} 歲 · ${getRealm(life.stats.martial).name}）`, 174, 112);

      // 奇葩外號橫幅
      ctx.fillStyle = '#EFE5CE';
      ctx.fillRect(32, 128, 696, 98);
      ctx.strokeStyle = '#8C6224';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(32, 128, 696, 98);

      ctx.fillStyle = '#9E2424';
      ctx.font = 'bold 24px "Noto Serif TC", serif';
      ctx.fillText(`蓋棺封號：${ep.title}`, 46, 160);

      ctx.fillStyle = '#3B3228';
      ctx.font = '14.5px "Noto Serif TC", serif';
      wrapCanvasText(ctx, `百曉生毒舌銳評：「${ep.roast}」`, 46, 188, 665, 22);

      ctx.fillStyle = '#245C4E';
      ctx.font = 'bold 15.5px "Noto Serif TC", serif';
      ctx.fillText(`出身：${life.region.name}（比重 ${life.birthProb.toFixed(2)}%） ｜ 門牆：${life.sect} ｜ 絕藝：${life.topArt}`, 32, 256);

      ctx.fillStyle = '#9E2424';
      ctx.font = 'bold 15.5px "Noto Serif TC", serif';
      wrapCanvasText(ctx, `離奇死因：${life.deathCause}`, 32, 286, 560, 22);

      ctx.fillStyle = '#4A4035';
      ctx.font = '15px "Noto Serif TC", serif';
      ctx.fillText(`蓋棺四維：體魄 ${Math.round(life.stats.health)} · 心境 ${Math.round(life.stats.mind)} · 武學 ${Math.round(life.stats.martial)} · 情義 ${Math.round(life.stats.bonds)}（鬼市盲盒 ${life.blindBoxCount || 0} 抽）`, 32, 348);
    } else {
      ctx.fillStyle = '#1C1814';
      ctx.font = 'bold 34px "Noto Serif TC", serif';
      ctx.fillText(`${life.name}（降生於 ${life.region.name}）`, 34, 124);

      ctx.fillStyle = '#245C4E';
      ctx.font = 'bold 17px "Noto Serif TC", serif';
      ctx.fillText(`${life.eraObj.name} · 門第：${life.familyTier}（命格比重 ${life.birthProb.toFixed(2)}%）`, 34, 162);

      ctx.fillStyle = '#4A4035';
      ctx.font = '16px "Noto Serif TC", serif';
      ctx.fillText(`當地預期陽壽：男 ${life.region.leM} 歲 / 女 ${life.region.leF} 歲 · 五歲內夭折率 ${life.region.u5Mort}%`, 34, 206);
      ctx.fillText(`當地習武入流率：${life.region.martialRate}% · 流傳武學：${life.region.artsPool.join('、')}`, 34, 240);
    }

    ctx.strokeStyle = '#9E2424';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(634, 360, 78, 78);
    ctx.fillStyle = '#9E2424';
    ctx.font = 'bold 20px "Noto Serif TC", serif';
    ctx.fillText('百曉', 652, 394);
    ctx.fillText('勘合', 652, 422);

    ctx.fillStyle = '#6E6050';
    ctx.font = '14px "Noto Serif TC", serif';
    ctx.fillText('《江湖蒼生錄 · 八千萬眾》— 致敬 1in8b.life 金庸武俠荒誕人間模擬', 32, 434);

    const link = document.createElement('a');
    link.download = `jianghu_${life.serial}_${isDead ? 'epithet' : 'birth'}.png`;
    link.href = cv.toDataURL('image/png');
    link.click();
    showToast('已拓印並下載「百曉生鑑定圖卡」！');
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
        $('eraHint').textContent = eObj ? eObj.hint : '任憑天命隨機降生於「飛雪連天射白鹿，笑書神俠倚碧鴛」十四部天書交織的歷代江湖。';
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
