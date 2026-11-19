## System Description


The system is a parking lot with sensors that detect cars arriving, entering, exiting and leaving. At the entrance and exit, there is a barrier that can be opened and closed, as well as a traffic light indicating whether a car should pass or not.
At the entrance, there is a ticket printer, and at the exit, there is a ticket scanner and payment machine.
At the entrance, there is also an electronic sign indicating how many free places the parking lot has left.

In normal operation, drivers must take a printed ticket before they can enter the parking lot, and they must scan their ticket and pay before they can leave. 

It is also possible for an operator to manually open the barrier at entry or exit. In this case, a car can enter or leave without interacting with the ticket printer/scanner or payment machine.

The system also keeps track of the number of cars in the parking lot. If the parking lot is full, then cars cannot enter.

You will use Statecharts to model a software controller that responds to the sensors, ticket, scanner, and payment machine, by opening/closing the entry/exit barriers at the right times.


### Sensors

At both the entry and exit, 2 sensors exist that detect the presence of a car. One sensor is placed before the barrier, the other sensor behind it.
For the entry, the sensors are named S0 (before barrier, outside the parking lot) and S1 (behind barrier, inside the parking lot). For the exit, the sensors are named S2 (before barrier, inside the parking lot) and S3 (behind barrier, outside the parking lot).

Sensors activate when a car is located next to it.
When a car arrives at the entry, it will activate sensor S0. If the barrier is opened and the car drives forward, it will activate S1 while S0 remains active. If the car continues to drive forward, it will de-activate S0 while S1 remains active. If the car drives even more forward (into the parking lot), S1 finally de-activates.

Likewise for cars exiting the parking lot, the "normal" order is:
    - none active
    - S2 active
    - S2 & S3 active
    - S3 active
    - none active


## Assumptions

A0. Only one car will block any of the entry sensors (S0/S1) at a time. The same holds for the exit sensors.

A1. If one sensor (e.g., S0 OR S1) but not both (e.g., S0 AND S1) are active, we assume that a car is in front (S0) of, or behind (S1) a barrier. In this case, if the barrier is CLOSED, the car will never attempt to drive through it.

    A2. If both sensors (S0 & S1 at the entry, or S2 & S3 at the exit) are active, we assume that there is a car PASSING THROUGH a barrier.

    A3. Drivers are opportunistic: If a barrier is OPEN but its corresponding traffic light is RED, cars may still pass through it.

    A4. You may assume that initially:
        - all barriers are CLOSED.
        - all traffic lights are RED.
        - no ticket has been printed.
        - there are no cars in the system.

    A5. Cars do not necessarily always drive forward: they may reverse at any point in time, but will never hit a CLOSED barrier (cfr. A1).

    A6. Cars can only interact with the ticket machine (i.e., take a ticket) or payment machine (i.e., scan their ticket, pay) if they are located next to it.


## Requirements

### Counting


    R0. As cars enter and exit the parking lot, the car count MUST ALWAYS be increased/decreased accordingly. A car has entered/exited when it has passed through the entry/exit barrier.

    R1. The remaining capacity (= (total capacity - car count)) must ALWAYS be displayed at the entrance.

    R2. If the remaining parking lot capacity is zero, then a CLOSED barrier must ALWAYS remain CLOSED, and the ticket machine MUST NEVER print any tickets.

### Entry procedure

    R3. When a car arrives at the entrance (-> S0 activates), and there is at least one free spot in the parking lot, the ticket machine should print a ticket with a unique ID (just use a counter: first ticket has ID 0, then 1, 2, 3, etc.).

    R4. When a car takes a ticket at the entrance, the entry barrier must OPEN and the entry traffic light must become GREEN.

    R5. If then (after R3), the car does not drive forward or reverse for 3 seconds, the entry traffic light must become RED, and one second later (= 4 seconds total after taking the ticket), the barrier must CLOSE again and another ticket must be printed. If the car wants to enter the parking lot, it must take the new ticket.

    R6. If after R3, the car reverses (leaving the system) instead of passing through the barrier, the traffic light must become RED and the barrier must CLOSE.

    R7. While a car is PASSING THROUGH the opened entry barrier, the entry traffic light must become RED (to indicate any approaching vehicle to not attempt passing through since the barrier will close soon).

    R8. When a car has passed through the opened entry-barrier (e.g., S0 de-activates WHILE S1 active), the barrier immediately CLOSES. The system must also record the ticket ID's corresponding timestamp of entry.
        Tips:
            - use the `_simtime` variable to get the current time (in milliseconds of simulated time)
            - use a dictionary that maps ticket IDs to entry-times.

### Exit procedure (very similar to entry procedure, I'm sorry)

    R9. When a car arrives at the exit (-> S2 activates), where the payment machine is located, it may scan its ticket. payment machine should then prompt the driver to pay for the amount of time spent on the parking lot.
        Tips:
            - use the `_simtime` variable to get the current time (in milliseconds of simulated time)
    
    R12. If a driver has payed, the exit traffic light becomes GREEN and the exit barrier OPENS.

    R13. If then (after R12), the car does not drive forward or reverse for 3 seconds, the exit traffic light must become RED, and one second later (= 4 seconds total after payment), the barrier must CLOSE again. If the car wants to enter the parking lot, it must scan its ticket again and pay for the extra time spent on the parking lot since its earlier payment.
        Tips:
            - when a driver pays for his stay, reset the entry timestamp of his ticket ID to the time of the payment

    R14. If after R12, the car reverses (parking his car again) instead of passing through the barrier, the traffic light must become RED and the barrier must CLOSE.

    R15. While a car is PASSING THROUGH the opened exit barrier, the exit traffic light must become RED (to indicate any approaching vehicle to not attempt passing through since the barrier will close soon).

    R16. When a car has passed through the opened exit-barrier (e.g., S2 de-activates WHILE S3 active), the barrier immediately CLOSES. All information about the car (its ticket ID and entry-timestamp) must be erased from the system.

### Safety

    R17. SAFETY: While a car is PASSING THROUGH an opened barrier (e.g., S0 AND S1 are active), the barrier MUST NEVER CLOSE. Failure to meet this requirement will cause a major accident (with fire (try it :)).

### Manual override

    R18. Either barrier (entry/exit) can be manually opened by a parking lot operator. Manually opening a barrier is a discrete event (e.g., a button press), and the system should respond by immediately OPENING the barrier and setting its traffic light to GREEN. After 3 seconds, the traffic light becomes RED and then one second later (= 4 seconds total after manual override), the barrier CLOSES (unless if a car is PASSING THROUGH (cfr. R17), then the barrier closes as soon as no car is PASSING THROUGH).

