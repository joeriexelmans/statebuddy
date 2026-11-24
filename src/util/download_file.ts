import { buf2base64 } from "@/util/deflate";

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

export function downloadArrayBuffer(contents: ArrayBuffer, mimetype: string, filename: string) {
  const dataStr = `data:${mimetype};base64,${buf2base64(contents)}`;
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href",     dataStr);
  downloadAnchorNode.setAttribute("download", filename);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
