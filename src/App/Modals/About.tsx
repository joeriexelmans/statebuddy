import { Logo, statebossLocalStorageKey } from "@/App/Logo/Logo";
import { useAudioContext } from "@/hooks/useAudioContext";
import { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";

import jingle from "../../../artwork/corporate-logo/stateboss.opus";


export function About(props: {setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const [_, poke] = useState(false);

  const trialStarted = localStorage.getItem(statebossLocalStorageKey);
  if (trialStarted) {
    return <AboutStateBoss {...props} trialStarted={trialStarted}/>
  }
  else {
    return <AboutStateBuddy {...props} poke={poke}/>
  }
}

export function AboutStateBuddy({poke, ...props}: {poke: ()=>void, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const [_, setCount] = useState(0);
  
  return <div style={{maxWidth: '500px', padding: 4}}>
    <Logo onClick={() => {
      setCount(i => {
        if (i+1 === 7) {
          localStorage.setItem(statebossLocalStorageKey, new Date().toISOString())
          poke(); // just trigger a re-render of our parent (to switch to StateBoss)
        }
        return i+1;
      });
    }}/>

    <p>StateBuddy is an <a target="_blank" href="https://deemz.org/git/research/statebuddy">open source</a> tool for <a target="_blank" href="https://dl.acm.org/doi/10.1016/0167-6423(87)90035-9">Statechart</a> editing, simulation, (omniscient) debugging and testing.</p>

    <p>It was originally created for teaching Statecharts to university students.</p>

    <p>The main novelty is in the way you deal with the visual concrete syntax: You just draw boxes, arrows and text. Connectedness or insideness are continuously figured out by a parser, but they do not influence what you can do with the shapes, which IMO is much more intuitive than editors that try to "help" you. This idea comes from <a target="_blank" href="https://dl.acm.org/doi/10.1145/3417990.3421401">CouchEdit</a>, which was in turn influenced by the very old tool <a target="_blank" href="https://en.wikipedia.org/wiki/I-Logix#History">Statemate</a>.</p>
    
    <p>Unique to StateBuddy is that sides of boxes, and endpoints of arrows can be independently selected for many boxes/arrows simultaneously, making editing even more powerful while remaining highly intuitive to both novice and expert users.</p>

    <p>No commercial use without my permission.</p>

    <p>Contact: <a href="mailto:joeri.exelmans@gmail.com">joeri.exelmans@gmail.com</a></p>

    <button onClick={() => props.setModal(null)}>OK</button>
    </div>;
}

export function AboutStateBoss(props: {trialStarted: string, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const remainingDays = 30 + Math.floor((Date.now() - Date.parse(props.trialStarted)) / (1000 * 60 * 60 * 24));

  const [play] = useAudioContext(1);

  useEffect(() => {
    play(jingle, false, 1);
  }, [])

  return <div style={{maxWidth: '500px', padding: 4, backgroundColor: "#fc3b00"}}>
    
    <Logo/>

    <div style={{fontSize: 20}}>

    <p>Unleash the POWER of State Machines with <b><em>StateBoss®™</em></b>, a LOW-CODE solution for the development of DIGITAL TWINS.</p>

    <p><b><em>StateBoss®™</em></b> uses proprietary Blockchain technology to ensure the smoothest of all <a href="https://dl.acm.org/doi/abs/10.1007/s10270-024-01194-w">modeling experiences</a>.</p>

    <p ></p>

    <p>This is your FREE TRIAL.<br/>
    You have <span style={{fontWeight: 600, color: "yellow", fontSize: 30}}>{remainingDays} days</span> remaining before you must BUY a license!!</p>

    </div>

    <p style={{color: '', fontSize: 16}}>Coming soon: <b><em>StateBoss®™ Extreme</em></b> with <b>AI Assisted Modeling</b>.</p>


    <div style={{textAlign: 'left', fontSize: 10}}>
      <div>
        <label>
          <input type="checkbox" checked/>
          I accept the <b><em>StateBoss®™</em></b> terms and conditions, and its hard stance against pirated copies as well as attempt or ideation of circumvention of the <b><em>StateBoss®™</em></b> Digital Rights Management (<b><em>StateBoss®™</em></b> DRM) patented technology.
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" checked/>
          I accept the <b><em>StateBoss®™</em></b> privacy policy.
        </label>
      </div>
      <br/>
      <div>
        I wish to receive <b><em>BossExpress®™</em></b>, the <b><em>StateBoss®™</em></b> weekly magazine via:
        <div>
          <label>
            <input type="checkbox" checked/>
            E-mail
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" checked/>
            Physical mail (5 USD will be charged for every delivered, undelivered or returned copy)
          </label>
        </div>
      </div>
      To cancel your subscription(s), call <a href="tel:1-800-BOSS">1-800-BOSS</a> - Mon-Fri 8:00 AM - 6:00 PM (0.50 USD per minute) Sat-Sun 10:00 AM - 6:00 PM (2 USD per minute).
    </div>

    <br/>
    <button onClick={() => props.setModal(null)} style={{fontStyle: 'italic', fontWeight: 600, fontSize:30, backgroundColor: 'black', color: "#fc3b00", border: 0}}>I ACCEPT</button>
  </div>
}
