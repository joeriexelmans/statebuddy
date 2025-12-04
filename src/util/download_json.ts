// https://stackoverflow.com/a/30800715
export function downloadObjectAsJson(contents: any, filename: string){
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contents, null, 2));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href",     dataStr);
  downloadAnchorNode.setAttribute("download", filename);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
