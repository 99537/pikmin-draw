(function () {
  var state = {
    mode: "specific", // "specific"（依剩餘卡片自動配種類） | "any"（任選不同種類）
    condition: "eq", // none | eq | gte | lte
    maxPeople: 5
  };

  var currentTask = null;
  var logList = [];
  var roster = [];
  var pendingPicked = null; // 最近一次自動產生、尚未發布的卡片組合

  // ---- DOM refs ----
  var addCardType = document.getElementById("addCardType");
  var addCardNumber = document.getElementById("addCardNumber");
  var addCardBtn = document.getElementById("addCardBtn");
  var bulkImportText = document.getElementById("bulkImportText");
  var bulkImportBtn = document.getElementById("bulkImportBtn");
  var rosterSummary = document.getElementById("rosterSummary");
  var rosterList = document.getElementById("rosterList");
  var clearRosterBtn = document.getElementById("clearRosterBtn");

  var modeSpecificBtn = document.getElementById("modeSpecificBtn");
  var modeAnyBtn = document.getElementById("modeAnyBtn");
  var conditionSelect = document.getElementById("conditionSelect");
  var autoGenerateBtn = document.getElementById("autoGenerateBtn");
  var rerollBtn = document.getElementById("rerollBtn");
  var sentenceEditor = document.getElementById("sentenceEditor");
  var publishBtn = document.getElementById("publishBtn");
  var nextRoundBtn = document.getElementById("nextRoundBtn");
  var undoBtn = document.getElementById("undoBtn");
  var resetAllBtn = document.getElementById("resetAllBtn");

  var roundSentence = document.getElementById("roundSentence");
  var roundProgressBar = document.getElementById("roundProgressBar");
  var roundProgressText = document.getElementById("roundProgressText");
  var roundCardList = document.getElementById("roundCardList");
  var markCollectedBtn = document.getElementById("markCollectedBtn");
  var historyList = document.getElementById("historyList");
  var modeBadge = document.getElementById("modeBadge");
  var toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  function cardKey(typeId, number) {
    return typeId + "_" + number;
  }

  // ---- 種類下拉選單 ----
  window.PIKMIN_TYPES.forEach(function (t) {
    var opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    addCardType.appendChild(opt);
  });

  // ---- 卡片名單設定 ----
  function parseTypeInput(raw) {
    var s = raw.trim().toLowerCase();
    var byId = window.PIKMIN_TYPES.find(function (t) {
      return t.id === s;
    });
    if (byId) return byId.id;
    var byName = window.PIKMIN_TYPES.find(function (t) {
      return t.name === raw.trim() || t.name.replace("皮克敏", "") === raw.trim();
    });
    return byName ? byName.id : null;
  }

  addCardBtn.addEventListener("click", function () {
    var typeId = addCardType.value;
    var number = parseInt(addCardNumber.value, 10);
    if (!typeId || !number || number < 1 || number > 9) {
      showToast("請選擇種類並輸入 1-9 的數字");
      return;
    }
    Sync.pushItem("roster", { typeId: typeId, number: number, timestamp: Date.now() }).then(function () {
      showToast("已新增一張卡片");
    });
  });

  bulkImportBtn.addEventListener("click", function () {
    var lines = bulkImportText.value.split("\n").map(function (l) {
      return l.trim();
    }).filter(function (l) {
      return l.length > 0;
    });
    if (lines.length === 0) {
      showToast("請先貼上要匯入的卡片清單");
      return;
    }
    var toAdd = [];
    var errors = [];
    lines.forEach(function (line, idx) {
      var parts = line.split(/[,，\s]+/).filter(Boolean);
      if (parts.length < 2) {
        errors.push("第 " + (idx + 1) + " 行格式錯誤：" + line);
        return;
      }
      var typeId = parseTypeInput(parts[0]);
      var number = parseInt(parts[1], 10);
      if (!typeId || !number || number < 1 || number > 9) {
        errors.push("第 " + (idx + 1) + " 行無法辨識：" + line);
        return;
      }
      toAdd.push({ typeId: typeId, number: number, timestamp: Date.now() });
    });
    if (toAdd.length > 0) {
      Promise.all(toAdd.map(function (item) {
        return Sync.pushItem("roster", item);
      })).then(function () {
        showToast("已加入 " + toAdd.length + " 張卡片" + (errors.length ? "，" + errors.length + " 行有誤" : ""));
        bulkImportText.value = errors.length ? errors.join("\n") : "";
      });
    } else {
      showToast("沒有任何一行能辨識，請檢查格式");
    }
  });

  clearRosterBtn.addEventListener("click", function () {
    if (!confirm("確定要清空這裡手動新增的卡片嗎？（不會影響報到端已經登記的卡片）")) return;
    Sync.clearList("roster").then(function () {
      showToast("已清空卡片名單");
    });
  });

  function renderRoster() {
    var checkinEntries = logList.filter(function (e) {
      return e.roundId === "none";
    });
    var byType = {};
    roster.forEach(function (c) {
      byType[c.typeId] = (byType[c.typeId] || 0) + 1;
    });
    checkinEntries.forEach(function (e) {
      byType[e.typeId] = (byType[e.typeId] || 0) + 1;
    });
    var total = roster.length + checkinEntries.length;

    rosterSummary.innerHTML = "";
    var totalSpan = document.createElement("span");
    totalSpan.style.fontWeight = "700";
    totalSpan.textContent =
      "目前卡池共 " + total + " 張（手動登錄 " + roster.length + " ＋報到登記 " + checkinEntries.length + "）：";
    rosterSummary.appendChild(totalSpan);
    window.PIKMIN_TYPES.forEach(function (t) {
      if (!byType[t.id]) return;
      var chip = document.createElement("span");
      chip.className = "card-chip";
      chip.style.background = t.color;
      chip.style.color = t.text;
      chip.innerHTML = '<span class="dot"></span>' + t.name + " × " + byType[t.id];
      rosterSummary.appendChild(chip);
    });

    if (roster.length === 0) {
      rosterList.innerHTML =
        '<p style="color:var(--muted);">尚未手動登錄卡片（報到端已經登記的卡片一樣算在卡池裡，只是不會列在這份可刪除清單）</p>';
      return;
    }
    rosterList.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexWrap = "wrap";
    wrap.style.gap = "6px";
    roster
      .slice()
      .sort(function (a, b) {
        return (a.timestamp || 0) - (b.timestamp || 0);
      })
      .forEach(function (c) {
        var t = window.getPikminType(c.typeId);
        var chip = document.createElement("span");
        chip.className = "card-chip";
        chip.style.background = t ? t.color : "#ccc";
        chip.style.color = t ? t.text : "#000";
        chip.style.cursor = "pointer";
        chip.title = "點一下移除這張卡";
        chip.innerHTML = '<span class="dot"></span>' + (t ? t.name : c.typeId) + " " + c.number + " ✕";
        chip.addEventListener("click", function () {
          Sync.removeListItem("roster", c._id);
        });
        wrap.appendChild(chip);
      });
    rosterList.appendChild(wrap);
  }

  // ---- 出題方式 / 條件 / 名額 ----
  modeSpecificBtn.addEventListener("click", function () {
    state.mode = "specific";
    modeSpecificBtn.classList.add("active");
    modeAnyBtn.classList.remove("active");
  });

  modeAnyBtn.addEventListener("click", function () {
    state.mode = "any";
    modeAnyBtn.classList.add("active");
    modeSpecificBtn.classList.remove("active");
  });

  conditionSelect.addEventListener("change", function () {
    state.condition = conditionSelect.value;
  });

  document.querySelectorAll("[data-stepper]").forEach(function (el) {
    var key = el.getAttribute("data-stepper");
    var span = el.querySelector("span");
    el.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var delta = parseInt(btn.getAttribute("data-delta"), 10);
        state[key] = Math.max(1, Math.min(5, state[key] + delta));
        span.textContent = state[key];
      });
    });
  });

  var conditionTextMap = {
    eq: "力量值加總剛好為",
    gte: "力量值加總至少為",
    lte: "力量值加總最多為"
  };

  // ---- 依剩餘卡片自動出題 ----
  // 卡池 = 手動登錄的名單 ＋ 報到端登記的張數（roundId === "none"）
  //       － 已經在正式任務輪次中回報掉的張數（roundId !== "none"）
  function buildAvailablePool() {
    var inventoryCount = {};
    roster.forEach(function (c) {
      var k = cardKey(c.typeId, c.number);
      inventoryCount[k] = (inventoryCount[k] || 0) + 1;
    });
    var usedInRoundCount = {};
    logList.forEach(function (e) {
      var k = cardKey(e.typeId, e.number);
      if (e.roundId === "none") {
        inventoryCount[k] = (inventoryCount[k] || 0) + 1;
      } else {
        usedInRoundCount[k] = (usedInRoundCount[k] || 0) + 1;
      }
    });
    var pool = [];
    Object.keys(inventoryCount).forEach(function (k) {
      var remain = inventoryCount[k] - (usedInRoundCount[k] || 0);
      var lastUnderscore = k.lastIndexOf("_");
      var typeId = k.slice(0, lastUnderscore);
      var number = parseInt(k.slice(lastUnderscore + 1), 10);
      for (var i = 0; i < remain; i++) {
        pool.push({ typeId: typeId, number: number });
      }
    });
    return pool;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function pickCards(pool, count, distinctTypes) {
    var shuffled = shuffle(pool);
    if (!distinctTypes) {
      if (shuffled.length < count) return null;
      return shuffled.slice(0, count);
    }
    var picked = [];
    var usedTypes = {};
    for (var i = 0; i < shuffled.length && picked.length < count; i++) {
      var c = shuffled[i];
      if (!usedTypes[c.typeId]) {
        usedTypes[c.typeId] = true;
        picked.push(c);
      }
    }
    return picked.length === count ? picked : null;
  }

  function sentenceFromPicked(picked) {
    var sum = picked.reduce(function (s, c) {
      return s + c.number;
    }, 0);
    var s;
    if (state.mode === "specific") {
      var countsByType = {};
      picked.forEach(function (c) {
        countsByType[c.typeId] = (countsByType[c.typeId] || 0) + 1;
      });
      var parts = window.PIKMIN_TYPES.filter(function (t) {
        return countsByType[t.id];
      }).map(function (t) {
        return countsByType[t.id] + " 隻" + t.name;
      });
      s = "需要 " + parts.join("＋");
    } else {
      s = "需要 " + picked.length + " 隻不同種類的皮克敏";
    }
    if (state.condition !== "none") {
      s += "，" + conditionTextMap[state.condition] + " " + sum;
    }
    return s + "，符合的同學請上台！";
  }

  function autoGenerate() {
    var pool = buildAvailablePool();
    var picked = pickCards(pool, state.maxPeople, state.mode === "any");
    if (!picked) {
      pendingPicked = null;
      sentenceEditor.value = "";
      showToast(
        state.mode === "any"
          ? "剩餘卡片不足 " + state.maxPeople + " 種不同種類，請減少名額或補登卡片"
          : "剩餘卡片不足 " + state.maxPeople + " 張，請減少名額或補登卡片"
      );
      return;
    }
    pendingPicked = picked;
    sentenceEditor.value = sentenceFromPicked(picked);
  }

  autoGenerateBtn.addEventListener("click", autoGenerate);
  rerollBtn.addEventListener("click", autoGenerate);

  // ---- 發布任務 ----
  function makeRoundId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }

  function publishTask(reuseSentence) {
    var sentence = reuseSentence
      ? (currentTask ? currentTask.sentence : sentenceEditor.value.trim())
      : sentenceEditor.value.trim();

    if (!sentence) {
      showToast("請先按「自動產生任務」產生敘述");
      return;
    }

    var task = {
      sentence: sentence,
      maxPeople: state.maxPeople,
      roundId: makeRoundId(),
      createdAt: Date.now(),
      // 只有「這次剛按過自動產生」才附上具體挑到的卡片，沿用敘述開下一輪不附帶
      pickedCards: !reuseSentence && pendingPicked ? pendingPicked : null,
      pickedMarked: false
    };

    Sync.setValue("task", task).then(function () {
      showToast(reuseSentence ? "已開始下一輪！" : "任務已發布！");
      if (!reuseSentence) {
        pendingPicked = null;
        sentenceEditor.value = "";
      }
    });
  }

  publishBtn.addEventListener("click", function () {
    publishTask(false);
  });

  nextRoundBtn.addEventListener("click", function () {
    publishTask(true);
  });

  undoBtn.addEventListener("click", function () {
    Sync.removeLastItem("log").then(function (removed) {
      if (removed) {
        showToast("已撤銷：" + describeCard(removed));
      } else {
        showToast("目前沒有紀錄可以撤銷");
      }
    });
  });

  markCollectedBtn.addEventListener("click", function () {
    if (!currentTask || !currentTask.pickedCards || currentTask.pickedCards.length === 0) {
      showToast("這一輪沒有自動產生的卡片組合可以標記");
      return;
    }
    if (currentTask.pickedMarked) {
      showToast("這一輪已經標記過了");
      return;
    }
    var roundId = currentTask.roundId;
    var sentence = currentTask.sentence;
    var cards = currentTask.pickedCards;
    Promise.all(
      cards.map(function (c) {
        return Sync.pushItem("log", {
          typeId: c.typeId,
          number: c.number,
          roundId: roundId,
          sentence: sentence,
          timestamp: Date.now()
        });
      })
    )
      .then(function () {
        return Sync.setValue("task", Object.assign({}, currentTask, { pickedMarked: true }));
      })
      .then(function () {
        showToast("已標記 " + cards.length + " 張卡片收回，下次出題不會再挑到");
      });
  });

  resetAllBtn.addEventListener("click", function () {
    if (!confirm("確定要清空所有任務與回報紀錄嗎？此動作無法復原，會連報到端已經登記的卡片一起清空，通常只在活動前測試時使用。")) {
      return;
    }
    Promise.all([Sync.clearList("log"), Sync.setValue("task", null)]).then(function () {
      showToast("已清空所有任務與回報資料");
    });
  });

  function describeCard(entry) {
    var t = window.getPikminType(entry.typeId);
    return (t ? t.name : entry.typeId) + " " + entry.number + " 號";
  }

  // ---- 畫面更新 ----
  function render() {
    if (!currentTask) {
      roundSentence.textContent = "尚未發布任務";
      roundProgressBar.style.width = "0%";
      roundProgressText.textContent = "0 / 0 人已上台";
      roundCardList.innerHTML = "";
      markCollectedBtn.disabled = true;
      markCollectedBtn.textContent = "🗑️ 標記本輪卡片已收回（避免下次出題重複挑到）";
    } else {
      roundSentence.textContent = currentTask.sentence;
      var thisRound = logList.filter(function (e) {
        return e.roundId === currentTask.roundId;
      });
      var pct = currentTask.maxPeople
        ? Math.min(100, (thisRound.length / currentTask.maxPeople) * 100)
        : 0;
      roundProgressBar.style.width = pct + "%";
      roundProgressText.textContent = thisRound.length + " / " + currentTask.maxPeople + " 人已上台";
      roundCardList.innerHTML = "";
      thisRound.forEach(function (e) {
        var t = window.getPikminType(e.typeId);
        var chip = document.createElement("span");
        chip.className = "card-chip";
        chip.style.background = t ? t.color : "#ccc";
        chip.style.color = t ? t.text : "#000";
        chip.innerHTML = '<span class="dot"></span>' + (t ? t.name : e.typeId) + " " + e.number;
        roundCardList.appendChild(chip);
      });

      var hasPicked = currentTask.pickedCards && currentTask.pickedCards.length > 0;
      if (!hasPicked) {
        markCollectedBtn.disabled = true;
        markCollectedBtn.textContent = "🗑️ 這一輪不是自動產生的，沒有可標記的卡片";
      } else if (currentTask.pickedMarked) {
        markCollectedBtn.disabled = true;
        markCollectedBtn.textContent = "✅ 這一輪的卡片已經標記收回過了";
      } else if (thisRound.length > 0) {
        markCollectedBtn.disabled = true;
        markCollectedBtn.textContent = "🗑️ 報到端已經逐一回報過，不用再整批標記";
      } else {
        markCollectedBtn.disabled = false;
        markCollectedBtn.textContent =
          "🗑️ 標記這 " + currentTask.pickedCards.length + " 張卡片已收回（避免下次出題重複挑到）";
      }
    }
    renderHistory();
    renderRoster();
  }

  function renderHistory() {
    if (logList.length === 0) {
      historyList.innerHTML = '<p style="color:var(--muted);">尚無紀錄</p>';
      return;
    }
    var byRound = {};
    var order = [];
    logList.forEach(function (e) {
      if (!byRound[e.roundId]) {
        byRound[e.roundId] = [];
        order.push(e.roundId);
      }
      byRound[e.roundId].push(e);
    });
    order.reverse();
    historyList.innerHTML = "";
    order.forEach(function (roundId) {
      var entries = byRound[roundId];
      var div = document.createElement("div");
      div.className = "history-round";
      var isCheckin = roundId === "none";
      var sentenceDiv = document.createElement("div");
      sentenceDiv.className = "sentence";
      sentenceDiv.textContent = isCheckin ? "📋 報到登記（尚未出題時登記的卡片）" : (entries[0].sentence || "(無敘述)");
      var metaDiv = document.createElement("div");
      metaDiv.className = "meta";
      var firstTime = new Date(entries[0].timestamp);
      metaDiv.textContent =
        firstTime.toLocaleTimeString() + " · 共 " + entries.length + (isCheckin ? " 張卡" : " 人");
      var cardsDiv = document.createElement("div");
      cardsDiv.className = "round-card-list";
      cardsDiv.style.justifyContent = "flex-start";
      entries.forEach(function (e) {
        var t = window.getPikminType(e.typeId);
        var chip = document.createElement("span");
        chip.className = "card-chip";
        chip.style.background = t ? t.color : "#ccc";
        chip.style.color = t ? t.text : "#000";
        chip.innerHTML = '<span class="dot"></span>' + (t ? t.name : e.typeId) + " " + e.number;
        cardsDiv.appendChild(chip);
      });
      div.appendChild(sentenceDiv);
      div.appendChild(metaDiv);
      div.appendChild(cardsDiv);
      historyList.appendChild(div);
    });
  }

  // ---- init ----
  var mode = Sync.init();
  modeBadge.textContent = "連線模式：" + (mode === "firebase" ? "Firebase（跨裝置）" : "本機測試（同瀏覽器分頁）");
  modeBadge.className = "mode-badge " + mode;

  Sync.onValue("task", function (val) {
    currentTask = val;
    render();
  });
  Sync.onList("log", function (arr) {
    logList = arr;
    render();
  });
  Sync.onList("roster", function (arr) {
    roster = arr;
    renderRoster();
  });
})();
