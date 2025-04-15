

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

async function showManhattanTrees() {
  const data = await fetchAllTrees();
  const manhattanTrees = data.filter(tree => tree.boroname === "Manhattan");

  const listContainer = document.getElementById("tree-list");
  const loadingText = document.getElementById("loading");
  loadingText.innerText = `共找到 ${manhattanTrees.length} 棵树：`;

  manhattanTrees.forEach(tree => {
    const div = document.createElement("div");
    div.className = "tree-item";
    div.innerHTML = `
        <strong>🌲 ${tree.spc_common || "Unknown species"}</strong><br>
        ID: ${tree.tree_id}<br>
        Status: ${tree.status || 'N/A'}<br>
        健康状况: ${tree.health || "Unknown"}<br>
        位置: (${tree.latitude}, ${tree.longitude})<br>
        steward	有无认领照顾者: ${tree.steward || 'N/A'}<br>
        user_type 谁收集的数据: ${tree.user_type || 'N/A'}
      `;
    listContainer.appendChild(div);
  });
}

showManhattanTrees();