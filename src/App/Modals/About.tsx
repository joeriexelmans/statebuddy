import { useAudioContext } from "@/hooks/useAudioContext";
import { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";
import { preload } from "react-dom";
import cinematicBoom from "../../../artwork/corporate-logo/cinematic-boom.opus";
import explosion from "../../../artwork/corporate-logo/explosion.opus";
import corporateLogo from "../../../artwork/corporate-logo/StateBOSS-logo-alt.webp";
import jingle from "../../../artwork/corporate-logo/stateboss.opus";
import { CorporateLogo } from "../Logo/CorporateLogo";
import { Logo } from "../Logo/Logo";
import { usePersistentState } from "@/hooks/usePersistentState";

const boomAt = 500; // ms into 'cinematic boom' where the boom actually happens


export function About(props: {setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const [trialStarted, setTrialStarted] = usePersistentState<string|null>("stateboss-trial-started", null);

  if (trialStarted) {
    return <AboutStateBoss {...props} trialStarted={trialStarted}/>
  }
  else {
    return <AboutStateBuddy {...props} setTrialStarted={setTrialStarted}/>
  }
}

export function AboutStateBuddy({setTrialStarted, ...props}: {setTrialStarted: Dispatch<SetStateAction<string|null>>, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const [_, setCount] = useState(0);

  preload(corporateLogo, {as: "fetch"});
  
  return <div style={{maxWidth: '500px', padding: 4}}>
    <Logo onClick={() => {
      setCount(i => {
        if (i+1 === 7) {
          setTimeout(() => setTrialStarted(new Date().toISOString()), 0); // just trigger a re-render of our parent (to switch to StateBoss)
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

  const [show, setShow] = useState(false);
  const [play, preloadAudio] = useAudioContext(1);

  preloadAudio(jingle);
  preloadAudio(explosion);
  preloadAudio(cinematicBoom);
  setTimeout(() => setFullyLoaded(true), 100);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const playing = play(jingle, false);
    playing.then(() => {
      timeout = setTimeout(() => setShow(true), 410);
    });
    return () => {
      playing.then(src => src.stop());
      clearTimeout(timeout);
    };
  }, []);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptEmail, setAcceptEmail] = useState(false);
  const [acceptPhysicalMail, setAcceptPhysicalMail] = useState(false);

  const [fullyLoaded, setFullyLoaded] = useState(false);

  useEffect(() => {
    if (fullyLoaded) {
      play(explosion, false, 0.8);
    }
  }, [acceptTerms, acceptPrivacy, acceptEmail, acceptPhysicalMail]);

  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const forceAccept = (x: boolean) => x || accepting;

  if (!show) {
    return <></>;
  }

  const onAccept = () => {
    if (!accepting && !accepted) {
      // make sure the user gets what he wants
      let delay = 0;
      const randomize = (delay:number) => delay * (1.2+Math.random()*0.7); // extra realism
      const getInterval = () => randomize(350);
      if (!acceptTerms) {
        setAccepting(true);
        setTimeout(() => setAcceptTerms(true), delay);
        delay += getInterval();
      }
      if (!acceptPrivacy) {
        setAccepting(true);
        setTimeout(() => setAcceptPrivacy(true), delay);
        delay += getInterval();
      }
      if (!acceptEmail) {
        setAccepting(true);
        setTimeout(() => setAcceptEmail(true), delay);
        delay += getInterval();
      }
      if (!acceptPhysicalMail) {
        setAccepting(true);
        setTimeout(() => setAcceptPhysicalMail(true), delay);
        delay += getInterval();
      }
      setTimeout(() => setAccepted(true), delay);

      setTimeout(() => {
        play(cinematicBoom, false).then(() => {
          setTimeout(() => props.setModal(null), boomAt);
        })
      }, delay+1300-boomAt);
    }
  };

  return <div style={{maxWidth: '500px', padding: 8, backgroundColor: "#fc3b00"}}>
    <CorporateLogo width="100%"/>
    <div style={{fontSize: 20}}>
      <p>Unleash the POWER of State Machines with <b><em>StateBoss®™</em></b>, a LOW-CODE solution for the development of DIGITAL TWINS.</p>
      <p><b><em>StateBoss®™</em></b> uses proprietary Blockchain technology to ensure the smoothest of all <a href="https://dl.acm.org/doi/abs/10.1007/s10270-024-01194-w">modeling experiences</a>.</p>
      <p>This is your FREE TRIAL.<br/>
      You have <span style={{fontWeight: 600, color: "yellow", fontSize: 30}}>{remainingDays} days</span> remaining before you must BUY a license!!</p>
    </div>

    <p style={{color: '', fontSize: 16}}>Coming soon: <b><em>StateBoss®™ Extreme</em></b> with <b>AI Assisted Modeling</b>.</p>

    <div style={{textAlign: 'left', fontSize: 10}}>
      <style>{`
        input[type=checkbox] {
          accent-color: black;
        }
      `}</style>
      <div>
        <label>
          <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(forceAccept(e.target.checked))}/>
          I accept the <b><em>StateBoss®™</em></b> terms and conditions, and its hard stance against pirated copies as well as attempt or ideation of circumvention of the <b><em>StateBoss®™</em></b> Digital Rights Management (<b><em>StateBoss®™</em></b> DRM) patented technology.
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" checked={acceptPrivacy} onChange={e => setAcceptPrivacy(forceAccept(e.target.checked))}/>
          I accept the <b><em>StateBoss®™</em></b> privacy policy.
        </label>
      </div>
      <br/>
      <div>
        I wish to receive <b><em>BossExpress®™</em></b>, the <b><em>StateBoss®™</em></b> weekly magazine via:
        <div>
          <label>
            <input type="checkbox" checked={acceptEmail} onChange={e => setAcceptEmail(forceAccept(e.target.checked))}/>
            E-mail
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" checked={acceptPhysicalMail} onChange={e => setAcceptPhysicalMail(forceAccept(e.target.checked))}/>
            Physical mail
          </label>
        </div>
      </div>
      5 USD will be charged for every delivered, undelivered or returned copy of physical mail.
      To cancel your subscription(s), call <a href="tel:1-800-BOSS">1-800-BOSS</a> - Mon-Fri 8:00 AM - 6:00 PM (0.50 USD per minute) Sat-Sun 10:00 AM - 6:00 PM (2 USD per minute). Extra charges may apply.
    </div>

    <br/>
    <style>{`
    .notAccepted {
      background-color: black;
      color: #fc3b00;
      cursor: pointer;
    }
    .notAccepted:active {
      padding-left: 6px;
      padding-top: 6px;
    }
    .optimizing {
      background-color: #444;
      color: white;
      cursor: default;
    }
    .accepted {
      background-color: green;
      color: white;
      cursor: default;
    }`}</style>
    <div
      onClick={onAccept}
      className={accepted ? "accepted" : (accepting ? "optimizing" : "notAccepted")}
      style={{
        fontStyle: 'italic',
        fontWeight: 600,
        fontSize:30,
        border: 0,
        boxSizing: 'border-box',
        height: 36,
        userSelect: 'none',
      }}>{accepted ? "ANOTHER SATISFIED CUSTOMER" : (accepting ? "OPTIMIZING YOUR EXPERIENCE..." : "I ACCEPT")}</div>
  </div>
}
