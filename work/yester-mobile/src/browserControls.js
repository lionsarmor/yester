export const nativeControls = {
  async configure(muted, tap) {
    window.yesterMediaPreference = {muted, tap};
    window.dispatchEvent(new Event("yester-audio"));
    return !!document.querySelector("iframe[data-member-media]");
  },
  addListener(name, listener) {
    function key(event) {
      if (event.key === "Escape" && !document.fullscreenElement) listener({action:"dismiss"});
      if (["Enter", " "].includes(event.key) && event.target.closest?.("[aria-label^='Browser grip'],[aria-label='Exit fullscreen']")) {
        event.preventDefault(); listener({action:"grip"});
      }
      if (event.altKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        listener({action:"address"});
      }
    }
    window.addEventListener("keydown", key);
    return {remove:()=>window.removeEventListener("keydown",key)};
  }
};
