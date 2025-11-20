import { useEffect, useState } from "react";
import { Logo } from "../Logo/Logo";

export function Greeter(props: {}) {
  const [showGreeting, setShowGreeting] = useState(true);
  useEffect(() => {
    setTimeout(() => setShowGreeting(false), 2000);
  });
  return <>
  {showGreeting &&
    <div className="greeter" style={{textAlign:'center'}} onClick={() => setShowGreeting(false)}>
      <span style={{fontSize: 18, fontStyle: 'italic'}}>
        Welcome to
        &nbsp;
        <Logo width={250} height="auto" style={{verticalAlign: 'middle'}}/>
      </span>
    </div>
  }
  </>
}