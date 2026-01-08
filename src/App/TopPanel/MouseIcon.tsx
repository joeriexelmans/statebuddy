// function MouseIcon({left, right, middle}: {left: boolean, right: boolean, middle: boolean}) {
//   return <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-mouse-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-4a4 4 0 0 1 -4 -4l0 -10" /><path d="M12 3v7" /><path d="M6 10h12" /></svg>;
// }

export function MouseIcon({left, right, middle}: {left: boolean, right: boolean, middle: boolean}) {
  if (!left && !right && !middle) {
    return <></>;
  }
  const activeColor = 'var(--firing-transition-color)';
  const backgroundColor = '#aaa';

  const getStyle = (active: boolean) => ({
    fill: active ? activeColor : backgroundColor,
    stroke: '#555',
    strokeWidth: 10,
  })

  return <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 344 480">
    <path style={getStyle(left)} d="M 149 7 v 211 H 0 q 0 -65 23 -128 T 149 7 z"/>
    <path style={getStyle(middle)} d="M 214 219 L 131 219 L 133 8 L 211 6 Z"/>
    <path style={getStyle(right)} d="M 192 7 q 64 8 106.5 56 T 341 218 H 192 V 7 z"/>
    <path style={getStyle(false)} d="M 0 304 v -85 h 341 v 85 q 0 71 -50 121 t -120.5 50 T 50 425 T 0 304 z"/>
  </svg>;
}
