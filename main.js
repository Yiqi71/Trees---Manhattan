// 纽约市的边界大概范围
const nycBounds = L.latLngBounds(
  [40.4774, -74.2591], // Southwest corner (Staten Island附近)
  [40.9176, -73.7004] // Northeast corner (Bronx & Queens上方)
);

// 初始化地图
const map = L.map('map', {
  maxBounds: nycBounds,
  maxBoundsViscosity: 1.0, // 拖不出边界
  minZoom: 13 // 防止放得太小
}).setView([40.7291, -73.9812], 15); // 默认显示曼哈顿的经纬度

// 引入OpenStreetMap的tile图层
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);


// 获取所有树的数据
async function fetchAllTrees() {
  let allData = [];
  let offset = 0;
  const limit = 1000;
  let moreData = true;

  while (moreData) {
    const response = await fetch(`https://data.cityofnewyork.us/resource/uvpi-gqnh.json?$limit=${limit}&$offset=${offset}&boroname=Manhattan`);
    const data = await response.json();
    allData = allData.concat(data);
    offset += limit;

    if (data.length < limit) {
      moreData = false;
    }
  }

  return allData;
}


function getTreeCategory(species) {
  const s = (species || "").toLowerCase();

  // 常绿树种
  if (
    s.includes("pine") || s.includes("spruce") || s.includes("fir") ||
    s.includes("cedar") || s.includes("hemlock") || s.includes("arborvitae") ||
    s.includes("holly") || s.includes("redcedar") || s.includes("white cedar")
  ) {
    return {
      group: "Evergreen",
      color: "#283618"
    }; // 深绿
  }

  // 坚果类（nut-producing trees）
  if (
    s.includes("walnut") || s.includes("hickory") || s.includes("chestnut") ||
    s.includes("hazelnut") || s.includes("pecan") || s.includes("beech") ||
    s.includes("oak") // 橡树也结坚果（acorns）
  ) {
    return {
      group: "Nut Tree",
      color: "#8B4513"
    }; // 棕色
  }

  // 水果类（fruiting trees）
  if (
    s.includes("cherry") || s.includes("crab") || s.includes("pear") ||
    s.includes("apple") || s.includes("serviceberry") || s.includes("dogwood") ||
    s.includes("hackberry") || s.includes("mulberry") || s.includes("ginkgo") ||
    s.includes("sweetgum") || s.includes("persimmon") || s.includes("fig") ||
    s.includes("plum") || s.includes("apricot") || s.includes("peach")
  ) {
    return {
      group: "Fruiting Tree",
      color: "#FFD700"
    }; // 黄色
  }

  // 会开花但不太结果的观赏树
  if (
    s.includes("redbud") || s.includes("magnolia") || s.includes("mimosa") ||
    s.includes("fringetree") || s.includes("empress") || s.includes("snowbell") ||
    s.includes("crepe") || s.includes("kousa") || s.includes("crimson king") ||
    s.includes("catalpa") || s.includes("tree lilac") || s.includes("maackia")
  ) {
    return {
      group: "Flowering Only",
      color: "#FF69B4"
    }; // 粉色
  }

  // 落叶但不开花不开果（或信息不足）
  return {
    group: "Deciduous Non-Flowering",
    color: "#90a955"
  }; // 浅绿色
}

// 显示曼哈顿的树，并在地图上添加标记
async function showManhattanTrees() {
  const data = await fetchAllTrees();
  const manhattanTrees = data.filter(tree => tree.boroname === "Manhattan");

  const listContainer = document.getElementById("tree-list");
  const loadingText = document.getElementById("loading");
  loadingText.innerText = ` ${manhattanTrees.length} trees you can talk to：`;

  manhattanTrees.forEach(tree => {
    if (tree.latitude && tree.longitude) {
      const category = getTreeCategory(tree.spc_common);

      L.circleMarker([tree.latitude, tree.longitude], {
          radius: 5,
          fillColor: category.color,
          fillOpacity: 0.8,
          color: 'white',
          weight: 0.8
        }).addTo(map)
        .bindPopup(`
        <b>🌳 ${tree.spc_common || "Unknown Tree"}</b><br>
        分类: ${category.group}<br>
        <button onclick="openChat('${tree.tree_id}', '${category.group}')">💬</button>
      `);
    }
  });
}

function openChat(id, group) {
  const chatBox = document.getElementById("chat-box");
  const chatLog = document.getElementById("chat-log");
  const chatOptions = document.getElementById("chat-options");

  chatBox.style.display = "block";
  chatLog.innerHTML = `<p>🌿 You're talking to tree ID ${id}</p>`;

  const questions = [
    "Will you blossom？",
    // "你会结果吗？",
    // "你叫什么名字？",
    // "你今天遇到了谁？",
    "Are you thirsty？"
  ];

  // 随机选3个问题
  const shuffled = questions.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  // 清空旧按钮
  chatOptions.innerHTML = "";

  // 创建按钮
  selected.forEach(q => {
    const btn = document.createElement("button");
    btn.innerText = q;
    btn.style.margin = "3px";
    btn.onclick = () => respondToQuestion(q, group);
    chatOptions.appendChild(btn);
  });
}

function respondToQuestion(question, group) {
  const chatLog = document.getElementById("chat-log");

  // const category = getTreeCategory(tree.spc_common);
  // 用户的问题
  chatLog.innerHTML += `<p>🧍 You：${question}</p>`;

  // 树的回答逻辑
  let response = "🌳 ...";

  if (question.includes("blossom")) {
    if (group == "Fruiting Tree" || group == "Nut Tree" || group == "Flowering Only") {
      response = "🌸";
    } else {
      response = "🙅‍♂️";
    }

  } else if (question.includes("结果")) {
    response = Math.random() < 0.3 ? "🍎 是的，我结出果实了！" : "我只是装饰型，不结果 😌";
  } else if (question.includes("你叫什么名字")) {
    response = "我没有正式的名字，不过你可以叫我小树～";
  } else if (question.includes("遇到了谁")) {
    response = "🍂 有风和一只松鼠来看我。";
  } else if (question.includes("thirsty")) {
    response = Math.random() < 0.4 ? "💧 yes" : "😊";
  }

  setTimeout(() => {
    chatLog.innerHTML += `<p>${response}</p>`;
    chatLog.scrollTop = chatLog.scrollHeight;
  }, 500);
}

function getTreeStatus() {
  const thirsty = Math.random() < 0.3;
  const hasFruit = Math.random() < 0.2;
  const caredFor = Math.random() < 0.5;

  return {
    thirsty,
    hasFruit,
    caredFor
  };
}

function sendMessage() {
  const log = document.getElementById("chat-log");

  const userMessage = input.value.trim();
  if (userMessage) {
    log.innerHTML += `<p>🧍 You：${userMessage}</p>`;
    input.value = "";

    // 简单回应（你可以后续接入 GPT 或规则回应）
    setTimeout(() => {
      log.innerHTML += `<p>🌳 ：我正在 photosynthesize 😌</p>`;
    }, 500);
  }
}


// 调用函数显示树的数据
showManhattanTrees();