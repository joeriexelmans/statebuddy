import logo from "../../artwork/logo.svg";

export function About() {
  return <div style={{display: 'inline-block', backgroundColor: 'white', width: 500, padding: 4}}>
    <p><img src={logo}/></p>
    <p>StateBuddy is a <a href="https://dl.acm.org/doi/10.1016/0167-6423(87)90035-9">statechart</a> editing, simulation, debugging and testing environment inspired by <a href="https://dl.acm.org/doi/10.1145/3417990.3421401">CouchEdit</a>.</p>
    <p>It was originally created for teaching Statecharts to university students, but likely is a useful tool for other purposes as well.</p>
    <p>StateBuddy is <a href="https://deemz.org/git/research/statebuddy">open source</a>.</p>
    <p>For commerical use, <a href="mailto:joeri.exelmans@gmail.com">e&#x2011;mail me</a> for permission.</p>
    </div>;
}
