import { useAudioContext } from "@/hooks/useAudioContext";
import { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";
import { preload } from "react-dom";
import cinematicBoom from "../../../artwork/corporate-logo/cinematic-boom.opus";
import explosion from "../../../artwork/corporate-logo/explosion.opus";
import corporateLogo from "../../../artwork/corporate-logo/StateBOSS-logo-alt.webp";
import jingle from "../../../artwork/corporate-logo/stateboss.opus";
import { CorporateLogo } from "../Logo/CorporateLogo";
import { Logo } from "../Logo/Logo";
import { Trial } from "../hooks/useTrial";

export function About({setModal, trialStarted, remainingDays, startTrial}: {setModal: Dispatch<SetStateAction<ReactElement|null>>} & Trial) {
  if (trialStarted) {
    return <AboutStateBoss
      remainingDays={remainingDays}
      setModal={setModal}
      />;
  }
  else {
    return <AboutStateBuddy
      startTrial={startTrial}
      setModal={setModal}
      />;
  }
}

export function AboutStateBuddy({startTrial, setModal}: {startTrial: () => void, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const [_, setCount] = useState(0);
  
  return <div style={{maxWidth: '500px', padding: 4, display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center'}}>
    <Logo onClick={() => {
      setCount(i => {
        if (i+1 === 7) {
          setTimeout(() => {
            startTrial();
            setModal(<AboutStateBoss remainingDays={30} setModal={setModal}/>);
          }, 0);
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

    <button onClick={() => setModal(null)}>OK</button>
    </div>;
}

const boomAt = 490; // ms into 'cinematic boom' where the boom actually happens. Note that we schedule the visual effect to be a bit too early. This is (1) to compensate for possible slow rendering, and (2) because it is perceived to be more realistic for the visual effect to be a bit too early rather than too late, because our brains are used to the fact that light travels faster than sound.

export function AboutStateBoss(props: {remainingDays: number, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {

  const [show, setShow] = useState(false);
  const [play, preloadAudio] = useAudioContext(1);

  preload(corporateLogo, {as: "image"});
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

  useEffect(() => {
    let snd = Promise.resolve<AudioBufferSourceNode|null>(null);
    if (accepted) {
      setTimeout(() => {
        snd = play(cinematicBoom, false);
        snd.then(() => {
          setTimeout(() => {
            snd = Promise.resolve(null); // this prevents the sound from being stopped when the modal closes because of timeout (we only want to stop the sound upon user cancelation)
            props.setModal(null);
          }, boomAt);
        });
      }, 1300-boomAt);
    }
    return () => {snd.then(snd => snd && snd.stop())};
  }, [accepted]);

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
    }
  };

  return <div style={{maxWidth: '500px', padding: 8, backgroundColor: "#fc3b00", color: 'black', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'stretch'}}>
    <CorporateLogo width="100%"/>
    <style>{`
      .blink{animation:blink 1s steps(1,end) infinite}
      @keyframes blink{50%{visibility:hidden}}
    `}</style>
    <div style={{fontSize: 20}}>
      <p>Unleash the POWER of State Machines with <b><em>StateBoss®™</em></b> LOW-CODE development
      <br/>of DIGITAL TWINS.</p>

      <div style={{fontSize: 16}}>
        <p>
          <b><em>StateBoss®™</em></b> uses proprietary Blockchain technology <br/> to ensure a <em>silky smooth</em> experience.
        </p>
        <p>
          Coming soon: <b><em>StateBoss®™ IntelliBOOST®™ AI-Assisted Modeling</em></b>.<br/>It can make your homework for you! With passing-grade guarantee!
        </p>
      </div>

      <p>This is your <b>FREE TRIAL</b>.<br/>
      You have <span className={!accepting && !accepted && "blink" || ""} style={{fontWeight: 600, color: "yellow", fontSize: 30}}>{props.remainingDays} days</span> remaining to BUY a license!</p>
    </div>

    <br/>
    <div style={{textAlign: 'left', fontSize: 12}}>
      <style>{`
        input[type=checkbox] {
          accent-color: black;
        }
      `}</style>
      <div>
        <label>
          <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(forceAccept(e.target.checked))}/>
          I accept the <b><em>StateBoss®™</em></b> terms and conditions
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" checked={acceptPrivacy} onChange={e => setAcceptPrivacy(forceAccept(e.target.checked))}/>
          I accept the <b><em>StateBoss®™</em></b> privacy policy.
        </label>
      </div>
      <div>
        I wish to receive <b><em>BossExpress®™</em></b>, the <b><em>StateBoss®™</em></b> weekly magazine(*) via:
        <div>
          <label>
            <input type="checkbox" checked={acceptEmail} onChange={e => setAcceptEmail(forceAccept(e.target.checked))}/>
            E-mail
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" checked={acceptPhysicalMail} onChange={e => setAcceptPhysicalMail(forceAccept(e.target.checked))}/>
            Physical mail (**)
          </label>
        </div>
      </div>
      <span style={{fontSize:9}}>
      (*) To cancel your subscription(s), call <a href="tel:1-800-BOSS">1-800-BOSS</a> - Mon-Fri 8:00 AM - 6:00 PM (0.50 USD per minute) Sat-Sun 10:00 AM - 6:00 PM (2 USD per minute). Extra charges may apply.<br/>
      (**) 5 USD will be charged for every delivered, undelivered or returned copy of physical mail.<br/>
      StateBoss Corp always has the right to legal action against any person suspected of circumventing or tampering with the SoftSpy (SS) Secure Patented Technology, as well as encouraging or assisting others to perform such actions, in any active or passive manner.
      </span>
    </div>

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
        fontSize: 'clamp(1rem, 5vw, 2rem)',
        border: 0,
        userSelect: 'none',
      }}>{accepted ? "ANOTHER SATISFIED CUSTOMER" : (accepting ? "OPTIMIZING YOUR EXPERIENCE..." : "I ACCEPT")}</div>
  </div>
}
