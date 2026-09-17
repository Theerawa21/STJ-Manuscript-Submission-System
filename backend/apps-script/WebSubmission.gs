// Convert browser uploads into Google blobs only after validating the author session.
function submitManuscriptFromWeb(form){
  return response_(function(){
    requireAuthor_(form&&form.author_token);
    if(!form||typeof form!=='object')throw userError_('ข้อมูลบทความไม่ถูกต้อง');
    var converted={},spec={word_file:['docx'],pdf_file:['pdf'],certificate_file:['pdf','doc','docx'],ai_disclosure_file:['pdf','doc','docx'],ethics_file:['pdf','doc','docx']};
    Object.keys(form).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(spec,key)&&typeof form[key]!=='object')converted[key]=String(form[key]);});
    Object.keys(spec).forEach(function(key){
      var file=form[key];
      if(!file){if(key==='word_file'||key==='pdf_file')throw userError_('กรุณาแนบไฟล์ Word และ PDF');return;}
      if(typeof file.name!=='string'||file.name.length>250||!spec[key].some(function(ext){return file.name.toLowerCase().endsWith('.'+ext);}))throw userError_('ประเภทไฟล์ไม่ถูกต้อง');
      if(typeof file.base64!=='string'||file.base64.length>20971520||!file.base64.length||file.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))throw userError_('ข้อมูลไฟล์ไม่ถูกต้องหรือมีขนาดเกิน 15 MB');
      var bytes=Utilities.base64Decode(file.base64);
      if(!bytes.length||bytes.length>15*1024*1024)throw userError_('ไฟล์มีขนาดเกิน 15 MB');
      var ext=file.name.split('.').pop().toLowerCase(),head=bytes.slice(0,5).map(function(b){return String.fromCharCode((b+256)%256);}).join('');
      if(ext==='pdf'&&head!=='%PDF-'||ext==='docx'&&head.slice(0,2)!=='PK'||ext==='doc'&&(bytes[0]+256)%256!==208)throw userError_('เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์');
      converted[key]=Utilities.newBlob(bytes,'application/octet-stream',file.name);
    });
    var result=submitManuscript(converted);
    if(!result.ok)throw userError_(result.error);
    return result.data;
  });
}
