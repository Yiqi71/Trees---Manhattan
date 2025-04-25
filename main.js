// localStorage.clear();

// network的线
let networkLine = null; // 连接线对象
let allTrees = [];
const markerMap = {};

// 初始化地图后添加一个矩形（可拖动）
let drawBox;
let exploreButton;

function initSelectionBox() {
  const bounds = L.latLngBounds(
    [40.72, -73.99], // Southwest corner
    [40.73, -73.97] // Northeast corner
  );

  drawBox = L.rectangle(bounds, {
    color: "#4caf50",
    weight: 2,
    draggable: true,
    fillOpacity: 0.1
  }).addTo(map);

  drawBox.editing.enable();

  // 添加探索按钮（固定在右下角）
  exploreButton = L.DomUtil.create("button", "explore-btn");
  exploreButton.innerText = "🌿 Explore this area";
  exploreButton.onclick = exploreTreesInBox;

  const container = map.getContainer();
  container.appendChild(exploreButton);
}

// 加载 drawBox 区域内的树
async function exploreTreesInBox() {
  const bounds = drawBox.getBounds();

  const data = await fetchAllTrees(); // 你原来的函数
  const inBox = data.filter(tree => {
    const lat = parseFloat(tree.latitude);
    const lng = parseFloat(tree.longitude);
    return lat && lng && bounds.contains([lat, lng]);
  });

  inBox.forEach(tree => {
    const category = getTreeCategory(tree.spc_common);
    const marker = L.circleMarker([tree.latitude, tree.longitude], {
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

    markerMap[tree.tree_id] = marker;
  });

  document.getElementById("loading").innerText = ` ${inBox.length} trees you can talk to in this area`;
}


async function loadMyNetworkTrees() {
  const data = await fetchAllTrees(); // 你原来的函数

  const myTreeIds = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
  console.log(myTreeIds);
  if (!data) {
    console.warn("🌐 data 未加载，无法展示 My Network 的树");
    return;
  }

  const myTrees = data.filter(tree => myTreeIds.includes(tree.tree_id));

  myTrees.forEach(tree => {
    const category = getTreeCategory(tree.spc_common);
    const marker = L.circleMarker([tree.latitude, tree.longitude], {
        radius: 6,
        fillColor: category.color,
        fillOpacity: 0.9,
        color: 'gold',
        weight: 2
      }).addTo(map)
      .bindPopup(`
        <b>🌲 ${tree.spc_common || "Unknown Tree"}</b><br>
        分类: ${category.group}<br>
        <i>(In your network)</i><br>
        <button onclick="openChat('${tree.tree_id}', '${category.group}')">💬</button>
      `);

    markerMap[tree.tree_id] = marker;
  });
}




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

      const marker = L.circleMarker([tree.latitude, tree.longitude], {
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
      markerMap[tree.tree_id] = marker;
    }
  });
}

function openChat(id, group) {
  const chatBox = document.getElementById("chat-box");
  const chatLog = document.getElementById("chat-log");
  const chatOptions = document.getElementById("chat-options");

  chatBox.style.display = "block";
  chatLog.innerHTML = "";

  // 加载聊天记录
  loadChatLog(id, chatLog);

  let title = document.getElementById("chat-title");
  title.innerHTML = `🌿 ${id}`;

  saveTreeToNetwork(id);

  const questions = [
    "Will you blossom？",
    "Are you thirsty？"
  ];
  const shuffled = questions.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  chatOptions.innerHTML = "";
  selected.forEach(q => {
    const btn = document.createElement("button");
    btn.innerText = q;
    btn.style.margin = "3px";
    btn.onclick = () => respondToQuestion(q, group, id);
    chatOptions.appendChild(btn);
  });
}

function saveTreeToNetwork(id) {
  let network = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
  if (!network.includes(id)) {
    network.push(id);
    localStorage.setItem("myTreeNetwork", JSON.stringify(network));
  }
}

function addToChatLog(treeId, message) {
  const key = `chat_${treeId}`;
  const log = JSON.parse(localStorage.getItem(key)) || [];
  log.push(message);
  localStorage.setItem(key, JSON.stringify(log));
}

function updateChatLog(treeId, html) {
  const key = `chat_${treeId}`;
  localStorage.setItem(key, html);
}

function loadChatLog(treeId, chatLog){
  const key = `chat_${treeId}`;
  const savedChat = localStorage.getItem(key);
  if (savedChat) {
    chatLog.innerHTML = savedChat;
  }
}

function respondToQuestion(question, group, id) {
  const chatLog = document.getElementById("chat-log");

  chatLog.innerHTML += `<p class="human-res"> ${question} 🧍</p>`;

  let response = "🌳 ...";
  if (question.includes("blossom")) {
    if (group == "Fruiting Tree" || group == "Nut Tree" || group == "Flowering Only") {
      response = "🌸";
    } else {
      response = "🙅‍♂️";
    }
  } else if (question.includes("thirsty")) {
    response = Math.random() < 0.4 ? "💧 yes" : "😊";
  }

  setTimeout(() => {
    chatLog.innerHTML += `<p class="tree-res">${response}</p>`;
    updateChatLog(id, chatLog.innerHTML);
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
// showManhattanTrees();

function showMyNetwork() {
  if (networkLine) {
    map.removeLayer(networkLine);
    networkLine = null;
    return;
  }

  const network = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
  const positions = [];

  network.forEach(id => {
    const marker = markerMap[id]; // 假设你有一个 id → marker 的映射
    if (marker) {
      const latlng = marker.getLatLng();
      positions.push([latlng.lat, latlng.lng]);
    }
  });

  if (positions.length > 1) {
    networkLine = L.polyline(positions, {
      color: "purple",
      weight: 3,
      opacity: 0.7,
      dashArray: "8, 5"
    }).addTo(map);
    map.fitBounds(networkLine.getBounds());
  } else {
    alert("你至少需要联系两棵树才会画线！");
  }
}


initSelectionBox(); // 拖动方框初始化
loadMyNetworkTrees(); // 加载用户的树