import { Dispatch, PropsWithChildren, SetStateAction, useEffect, useRef, useState } from "react";

export type ScrollableState = {
  scrollTop: number,
  scrollLeft: number,
}

export const defaultScrollableState: ScrollableState = {
  scrollTop: 0,
  scrollLeft: 0,
}

type ScrollableProps = {
  state: ScrollableState,
  setState: Dispatch<SetStateAction<ScrollableState>>;
};

// Mutual exclusion thingy - only one party can temporarily gain access to the lock.
function useTempLock(timeoutMs: number) {
  const [_, setLock] = useState<{who: string, release: NodeJS.Timeout}|null>(null);

  function attempt(who: string, act: () => void) {
    setLock(lock => {
      if (lock) {
        if (lock.who === who) {
          // we already have the lock
          clearTimeout(lock.release); // extend our holding of the lock
          act();
        }
        else {
          return lock; // could not acquire lock
        }
      }
      else {
        console.log('acquired:', who);
        act();
      }
      return {
        who,
        release: setTimeout(() => {
          console.log('released');
          setLock(null);
        }, timeoutMs),
      };
    });
  }

  return attempt;
}

// The problem with controlling scroll state with React, is that:
//  - scroll events are the only reliable way to detect that the scrolling happened
//     works with: mouse wheel, touchpad, scrollbar!
//  - we use scroll events to update the scroll-state
//  - we also want the React scroll-state to control the DOM scroll-state, so we scroll our DOM node with useEffect() when React state changes
//  - this again triggers a scroll event
// The (hacky) solution presented here is to look at what happens FIRST:
//   a) a scroll event (-> event handler which sets React state)
//   b) a React state-change (-> useEffect which scrolls DOM)
// and to then disable the other mechanism for a brief amount of time. The reason for the timeout is that because of smooth scrolling, scroll events keep coming for a period of time "after the fact".
export function Scrollable({state, setState, children, ...rest}: PropsWithChildren<ScrollableProps> & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const attempt = useTempLock(1200);
  useEffect(() => {
    if (ref.current) {
      const scrollHandler = (e: Event) => {
        if (e.target) {
          attempt("SCROLL_EVENT", () => {
            // calling setState from setTimeout seems to solve React error "cannot update child while rendering parent"
            setTimeout(() => {
              setState({
                // @ts-ignore
                scrollTop: e.target.scrollTop,
                // @ts-ignore
                scrollLeft: e.target.scrollLeft,
              });
            });
          });
        }
      }
      ref.current.addEventListener("scroll", scrollHandler);
      return () => {
        ref.current?.removeEventListener("scroll", scrollHandler);
      }
    }
  }, [ref.current]);

  useEffect(() => {
    attempt("STATE_CHANGED", () => {
      if (ref.current) {
        ref.current.scrollTo({
          top: state.scrollTop,
          left: state.scrollLeft,
          behavior: 'smooth',
        });
      }
    });
  }, [state.scrollTop, state.scrollLeft])

  return <div ref={ref} {...rest}>
    {children}
  </div>
}
