/* The interface is hosted on GitHub Pages. Only data operations use the Google bridge. */
(function () {
  'use strict';
  var endpoint = 'https://script.google.com/macros/s/AKfycbxb5OnjYHag-LLEslsB_XjbNtV1wnDvbtFGjgPA21SxSjks2SHEiTT_tfwL2RJU9UA9/exec';
  var channel = crypto.randomUUID();
  var bridgeWindow = null;
  var bridgeOrigin = null;
  var pending = new Map();
  var allowed = ['getPublicConfig','authorLogin','registerAuthor','authorLogout','getMyManuscripts','submitManuscriptFromWeb','trackManuscript','editorLogin','editorLogout','getDashboard','getSubmissionDetail','updateSubmissionStatus'];
  var resolveReady, rejectReady;
  var ready = new Promise(function (resolve, reject) { resolveReady = resolve; rejectReady = reject; });
  // Attach a rejection handler immediately, including when the user is only browsing.
  ready.catch(function () {});
  var readyTimer = setTimeout(function () {
    rejectReady(new Error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าเว็บแล้วลองอีกครั้ง'));
    connection('เชื่อมต่อฐานข้อมูลไม่สำเร็จ', true);
  }, 45000);

  function connection(text, failed) {
    var element = document.getElementById('connectionStatus');
    if (element) { element.textContent = text; element.classList.toggle('error', !!failed); }
  }

  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || message.channel !== channel || message.protocol !== 'stj-bridge-v1') return;
    if (!/^https:\/\/([a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin)) return;
    if (message.kind === 'ready' && !bridgeWindow) {
      bridgeWindow = event.source;
      bridgeOrigin = event.origin;
      clearTimeout(readyTimer);
      connection('พร้อมใช้งาน');
      resolveReady();
      return;
    }
    if (event.source !== bridgeWindow || event.origin !== bridgeOrigin || message.kind !== 'response') return;
    var entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.result && message.result.ok) entry.resolve(message.result.data);
    else entry.reject(new Error(message.result && message.result.error || 'ระบบไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง'));
  });

  window.stjApi = async function (method, payload) {
    if (allowed.indexOf(method) < 0) throw new Error('ไม่รองรับการทำงานนี้');
    await ready;
    return new Promise(function (resolve, reject) {
      var id = crypto.randomUUID();
      var timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error(method === 'submitManuscriptFromWeb'
          ? 'หมดเวลารอผล กรุณาตรวจสอบบทความของฉันก่อนส่งซ้ำ'
          : 'หมดเวลารอผล กรุณาลองอีกครั้ง'));
      }, method === 'submitManuscriptFromWeb' ? 180000 : 60000);
      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      bridgeWindow.postMessage({ protocol:'stj-bridge-v1', kind:'request', channel:channel, id:id, method:method, payload:payload }, bridgeOrigin);
    });
  };

  window.stjFormPayload = async function (form) {
    var payload = {};
    for (var pair of new FormData(form).entries()) {
      var key = pair[0], value = pair[1];
      if (!(value instanceof File)) { payload[key] = value; continue; }
      if (!value.name || !value.size) continue;
      if (value.size > 15 * 1024 * 1024) throw new Error('ไฟล์ ' + value.name + ' มีขนาดเกิน 15 MB');
      var dataUrl = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error('อ่านไฟล์ ' + value.name + ' ไม่สำเร็จ')); };
        reader.readAsDataURL(value);
      });
      payload[key] = { name:value.name, mime:value.type || 'application/octet-stream', base64:String(dataUrl).split(',')[1] };
    }
    return payload;
  };

  document.addEventListener('DOMContentLoaded', function () {
    connection('กำลังเชื่อมต่อฐานข้อมูล…');
    var frame = document.createElement('iframe');
    frame.title = 'การเชื่อมต่อฐานข้อมูลวารสาร';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;clip-path:inset(50%);overflow:hidden;pointer-events:none';
    frame.src = endpoint + '?bridge=1&channel=' + encodeURIComponent(channel);
    document.body.appendChild(frame);
  });
})();
