(() => {
  if (typeof window.showSaveFilePicker === 'function') {
    window.retroPageDesktop = {async save(blob, suggestedName) {
      const file = await window.showSaveFilePicker({suggestedName, types: [{
        description: 'Retro Page project', accept: {'application/json': ['.yst']},
      }]});
      const stream = await file.createWritable();
      await stream.write(blob);
      await stream.close();
    }};
  }
  const desktopLink = document.querySelector('.download-app');
  if (desktopLink) {
    desktopLink.textContent = 'Play the neighborhood';
    desktopLink.href = 'https://yestersites.com/browse/?mode=playable';
    desktopLink.target = '_blank';
    desktopLink.rel = 'noopener noreferrer';
  }
  const match = /^#desktop-open=([0-9a-f]{48})$/.exec(location.hash);
  if (match) {
    history.replaceState(null, '', location.pathname);
    document.querySelector('.starter-chooser[open]')?.close();
    fetch('/desktop/project/' + match[1], {headers: {'X-Retro-Page': 'open'}})
      .then(async response => {
        if (!response.ok) throw new Error('Open the project again from File → Open.');
        const picker = document.getElementById('open-file');
        const transfer = new DataTransfer();
        transfer.items.add(new File([await response.blob()], 'desktop project.yst', {type: 'application/json'}));
        picker.files = transfer.files;
        picker.dispatchEvent(new Event('change'));
      }).catch(error => { document.getElementById('status').textContent = error.message; });
  }
  setInterval(() => fetch('/desktop/awake').catch(() => {}), 60000);
})();
