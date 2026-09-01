const count = document.querySelector("#confirm-count");
const list = document.querySelector("#confirm-list");
const confirm = document.querySelector("#confirm");

async function boot() {
  const items = await window.petApi.getRecycleConfirmation();
  count.textContent = `${items.length} 个文件 / 文件夹`;
  for (const item of items.slice(0, 8)) {
    const row = document.createElement("li");
    row.textContent = item.name;
    row.title = item.path;
    list.appendChild(row);
  }
  if (items.length > 8) {
    const row = document.createElement("li");
    row.textContent = `… 还有 ${items.length - 8} 个`;
    list.appendChild(row);
  }
}

document.querySelector("#close").addEventListener("click", () => window.petApi.closeRecycleConfirmation());
document.querySelector("#cancel").addEventListener("click", () => window.petApi.closeRecycleConfirmation());
confirm.addEventListener("click", async () => {
  confirm.disabled = true;
  const results = await window.petApi.confirmRecycle();
  const success = results.filter((result) => result.ok).length;
  count.textContent = `已吃掉 ${success} 个${results.length > success ? `，${results.length - success} 个失败` : ""}`;
  list.innerHTML = "";
  setTimeout(() => window.petApi.closeRecycleConfirmation(), 1000);
});

boot();
