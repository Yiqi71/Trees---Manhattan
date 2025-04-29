// localStorage.clear();


let map;
let networkLine = null;
let allTrees = [];
const markerMap = {};
let drawBox;
let exploreButton;

const personalities = [
  { type: "Cheerful", delay: 300 },
  { type: "Calm", delay: 1500 },
  { type: "Lazy", delay: 3000 },
  { type: "Talkative", delay: 500 },
  { type: "Silent", delay: 4000 }
];


function startExplore() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('map-screen').style.display = 'block';

  initMap();
  initSelectionBox();
}

function startNetwork() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('map-screen').style.display = 'block';

  initMap();
  loadMyNetworkTrees();
}

function backHome() {
  window.location.reload();
}

function initMap() {
  if (map) return;

  const nycBounds = L.latLngBounds(
    [40.4774, -74.2591],
    [40.9176, -73.7004]
  );

  map = L.map('map', {
    maxBounds: nycBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 13
  }).setView([40.7291, -73.9812], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
}

function initSelectionBox() {
  const bounds = L.latLngBounds(
    [40.72, -73.99],
    [40.73, -73.97]
  );

  drawBox = L.rectangle(bounds, {
    color: "#4caf50",
    weight: 2,
    draggable: true,
    fillOpacity: 0.1
  }).addTo(map);

  drawBox.editing.enable();

  // 创建 Explore 按钮
  exploreButton = L.DomUtil.create("button", "explore-btn");
  exploreButton.innerText = "🌿 Explore this area";
  exploreButton.onclick = exploreTreesInBox;

  // 把按钮添加到 map 容器
  const container = map.getContainer();
  container.appendChild(exploreButton);

  // 每次移动 drawBox 都重新定位按钮
  map.on('move', updateExploreButtonPosition);
  map.on('zoom', updateExploreButtonPosition);
  drawBox.on('edit', updateExploreButtonPosition);

  updateExploreButtonPosition();
}

function updateExploreButtonPosition() {
  if (!drawBox || !exploreButton) return;

  const bounds = drawBox.getBounds();
  const ne = bounds.getNorthEast(); // 右上角
  const sw = bounds.getSouthWest(); // 左下角

  // 算出右下角经纬度
  const rightBottom = L.latLng(sw.lat, ne.lng);
  const pixelPos = map.latLngToContainerPoint(rightBottom);

  exploreButton.style.left = `${pixelPos.x - 50}px`; // 按钮偏移一点点居中
  exploreButton.style.top = `${pixelPos.y - 20}px`; // 让按钮稍微高一点，不挡住边框
}

async function exploreTreesInBox() {
  const bounds = drawBox.getBounds();
  const data = await fetchAllTrees();
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
    }).addTo(map).bindPopup(`
      <b>🌳 ${tree.spc_common || "Unknown Tree"}</b><br>
      分类: ${category.group}<br>
      <button onclick="openChat('${tree.tree_id}', '${category.group}')">💬</button>
    `);
    markerMap[tree.tree_id] = marker;
  });

  document.getElementById("loading").innerText = `${inBox.length} trees you can talk to in this area`;
}

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

  if (s.includes("pine") || s.includes("spruce") || s.includes("fir") || s.includes("cedar") || s.includes("hemlock")) {
    return {
      group: "Evergreen",
      color: "#283618"
    };
  }
  if (s.includes("walnut") || s.includes("oak") || s.includes("chestnut")) {
    return {
      group: "Nut Tree",
      color: "#8B4513"
    };
  }
  if (s.includes("cherry") || s.includes("apple") || s.includes("pear")) {
    return {
      group: "Fruiting Tree",
      color: "#FFD700"
    };
  }
  if (s.includes("magnolia") || s.includes("redbud") || s.includes("crepe")) {
    return {
      group: "Flowering Only",
      color: "#FF69B4"
    };
  }
  return {
    group: "Deciduous Non-Flowering",
    color: "#90a955"
  };
}

function openChat(id, group) {
  const chatBox = document.getElementById("chat-box");
  const chatLog = document.getElementById("chat-log");
  const chatOptions = document.getElementById("chat-options");

  chatBox.style.display = "block";
  chatLog.innerHTML = "";
  loadChatLog(id, chatLog);

  document.getElementById("chat-title").innerText = `🌿 ${id}`;
  saveTreeToNetwork(id);
  assignPersonalityIfNeeded(id);

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

function respondToQuestion(question, group, id) {
  const chatLog = document.getElementById("chat-log");
  const userMsg = document.createElement('p');
  userMsg.className = 'human-res pop-msg';
  userMsg.textContent = `${formatTime()} 🧍 ${question}`;
  chatLog.appendChild(userMsg);


  let response = "🌳 ...";
  if (question.includes("blossom")) {
    response = ["Fruiting Tree", "Nut Tree", "Flowering Only"].includes(group) ? "🌸" : "🙅‍♂️";
  } else if (question.includes("thirsty")) {
    response = Math.random() < 0.4 ? "💧 yes" : "😊";
  }

  const personality = getPersonality(id);
  setTimeout(() => {
    const treeMsg = document.createElement('p');
    treeMsg.className = 'tree-res pop-msg';
    treeMsg.textContent = `${formatTime()} 🌳 ${response}`;
    chatLog.appendChild(treeMsg);
    updateChatLog(id, chatLog.innerHTML);
    chatLog.scrollTop = chatLog.scrollHeight;
  }, personality.delay);
}

function saveTreeToNetwork(id) {
  let network = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
  if (!network.includes(id)) {
    network.push(id);
    localStorage.setItem("myTreeNetwork", JSON.stringify(network));
  }
}

function loadChatLog(treeId, chatLog) {
  const key = `chat_${treeId}`;
  const savedChat = localStorage.getItem(key);
  if (savedChat) chatLog.innerHTML = savedChat;
}

function updateChatLog(treeId, html) {
  const key = `chat_${treeId}`;
  localStorage.setItem(key, html);
}

function loadMyNetworkTrees() {
  fetchAllTrees().then(data => {
    const myTreeIds = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
    const myTrees = data.filter(tree => myTreeIds.includes(tree.tree_id));
    const positions = [];

    myTrees.forEach(tree => {
      const category = getTreeCategory(tree.spc_common);
      const marker = L.circleMarker([tree.latitude, tree.longitude], {
        radius: 6,
        fillColor: category.color,
        fillOpacity: 0.9,
        color: 'gold',
        weight: 2
      }).addTo(map).bindPopup(`
        <b>🌲 ${tree.spc_common || "Unknown Tree"}</b><br>
        分类: ${category.group}<br>
        <i>(In your network)</i><br>
        <button onclick="openChat('${tree.tree_id}', '${category.group}')">💬</button>
      `);
      markerMap[tree.tree_id] = marker;

      const latlng = marker.getLatLng();
      positions.push([latlng.lat, latlng.lng]);
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
  });
}

function assignPersonalityIfNeeded(id) {
  const key = `personality_${id}`;
  if (!localStorage.getItem(key)) {
    const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    localStorage.setItem(key, JSON.stringify(randomPersonality));
  }
}

function getPersonality(id) {
  const key = `personality_${id}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    return JSON.parse(saved);
  }
  return { type: "Calm", delay: 1500 }; // 默认给个性格
}

function formatTime() {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');

  return `${month}-${date} ${hours}:${minutes}`;
}