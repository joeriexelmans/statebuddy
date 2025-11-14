import { Logo } from "@/App/Logo/Logo";
import { Dispatch, ReactElement, SetStateAction } from "react";

export function About(props: {setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  return <div style={{maxWidth: '500px', padding: 4}}>
    <p><Logo/></p>

    <p>StateBuddy is an <a target="_blank" href="https://deemz.org/git/research/statebuddy">open source</a> tool for <a target="_blank" href="https://dl.acm.org/doi/10.1016/0167-6423(87)90035-9">Statechart</a> editing, simulation, (omniscient) debugging and testing.</p>

    <p>It was originally created for teaching Statecharts to university students.</p>

    <p>The main novelty is in the way you deal with the visual concrete syntax: You just draw boxes, arrows and text. Connectedness or insideness are continuously figured out by a parser, but they do not influence what you can do with the shapes, which IMO is much more intuitive than editors that try to "help" you. This idea comes from <a target="_blank" href="https://dl.acm.org/doi/10.1145/3417990.3421401">CouchEdit</a>, which was in turn influenced by the very old tool <a target="_blank" href="https://en.wikipedia.org/wiki/I-Logix#History">Statemate</a>.</p>
    
    <p>Unique to StateBuddy is that sides of boxes, and endpoints of arrows can be independently selected for many boxes/arrows simultaneously, making editing even more powerful while remaining highly intuitive to both novice and expert users.</p>

    <p>No commercial use without my permission.</p>

    <p>Contact: <a href="mailto:joeri.exelmans@gmail.com">joeri.exelmans@gmail.com</a></p>

    <button onClick={() => props.setModal(null)}>OK</button>
    </div>;
}
