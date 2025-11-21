import { useEffect, useState } from "react";
import { Logo } from "../Logo/Logo";
import { CorporateLogo } from "../Logo/CorporateLogo";
import { Trial } from "../hooks/useTrial";

export function Greeter(props: {trial: Trial}) {
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
          {props.trial.trialStarted
            ? <CorporateLogo width="auto" height={100} style={{verticalAlign: 'middle'}}/>
            : <Logo width="auto" height={100} style={{verticalAlign: 'middle'}}/>
          }
        </span>
      </div>
    }
  </>;
}
