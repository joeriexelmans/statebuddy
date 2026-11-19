# MoSIS'26 Statecharts Assignment

## Introduction to the System

The system is a parking lot with an entrance and exit. The entrance and exit each have a barrier that can be opened or closed. In front and behind of each barrier is a sensor that detects the presence of a car. The purpose of these sensors is to detect whether a car is IN FRONT OF the barrier, PASSING THROUGH, or has PASSED the barrier. Next to each barrier there is also a traffic light indicating whether a car SHOULD pass.

At the entrance, there is additionally:
  - a ticket printer (which we won't use in this assignment)
  - an electronic sign indicating how many free parking spots there currently are.

At the exit, there is additionally:
  - a ticket scanner (which we won't use)
  - a payment machine

![](./figures/system.png)

In normal operation, cars can enter the parking lot via the entrance as long as there is at least one free parking spot. The entrance barrier only opens if there is car IN FRONT OF it and closes as soon as that car has PASSED the barrier (so no cars can avoid paying by leaving via the entrance).

Parked cars can leave the parking lot via the exit, where the barrier only opens after payment at a flat rate of 2 EUR.

The exit barrier can also overridden: a parking lot operator can click a special button causing the exit barrier to open and remain open for a limited amount of time, allowing a car to exit without paying (for VIPs).

### Assignment overview

Your task is to create a software controller for this parking lot, that:
  - opens/closes the entrance/exit barriers
  - sets the traffic lights to green/red
  - keeps track of the number of free parking spots by counting cars entering/exiting

The software controller is only aware of:
  - the changing state of the sensors at the entrance and exit
  - the payment machine registering a successful payment
  - the special 'override'-button that should open the exit barrier

## Detailed System Description

### Sensors

The reason for having 2 sensors at each barrier, is to detect whether a car has actually passed the barrier and not just reversed back to where it came from.

A car entering the parking lot will cause the following sequence of events:

  - initially, all sensors are inactive: s0(False) and s1(False)
  - when a car arrives in front of the entrance, s0 becomes active: s0(True)
  - while the car passes through the barrier, both sensors are active: s0(True) and s1(True)
  - when the car has passed the barrier, s0 becomes inactive: s0(False) and s1(True)
  - when the car continues driving to park, s1 becomes inactive: s0(False) and s1(False)

Likewise, the sequence for a car exiting the parking lot is:

  - s2(False), s3(False)
  - s2(True), s3(False)
  - s2(True), s3(True)
  - s2(False), s3(True)
  - s2(False), s3(False)

### Assumptions

    A0. Only one car is entering / exiting the parking lot at a time. In other words, only one car will block any of the entry sensors (S0/S1) or exit sensors (S2/S3) at a time.

    A1. Cars will never attempt to pass through a CLOSED barrier.

    A2. Drivers are opportunistic: if a barrier is OPEN but its traffic light is RED, they may still pass through it.

    A3. If a car is passing through an OPEN barrier, the barrier CAN close, resulting in an accident. Your solution should prevent this from happening (see Requirements).

    A4. Cars do not necessarily always drive forward: they may reverse at any point in time, but will never hit a CLOSED barrier (cfr. A1)

    A5. A car can only interact with the payment machine when it is IN FRONT OF the exit barrier (i.e., s2(True), s3(False)).

    A6. Initially:
      - all barriers are CLOSED.
      - all traffic lights are RED.
      - there are no cars in the system.

### Requirements

#### Counting


    R0. The car count must ALWAYS be updated when a car enters/exits the parking lot. More precisely, the car count MUST be updated when a car has PASSED the entrance/exit barrier.

#### Normal Entry Procedure

    R1. Whenever a car is IN FRONT OF the entrance barrier, AND there is at least one free spot in the parking lot, the entrance barrier MUST be OPEN and its traffic light MUST be GREEN. In all other cases, the traffic light must be RED.

      Note: This means that as soon as the car PASSES THROUGH the barrier, the traffic light becomes RED.

      Motivation: This RED signal is meant for a potential follow-up car.

    R2. As soon as a car that was PASSING THROUGH the entrance barrier has PASSED the barrier, the barrier CLOSES.
      
      Motivation: This makes it impossible for the car or any other car to leave the parking lot via the entrance.
    
#### Normal Exit Procedure

    R3. When a car is IN FRONT OF the exit barrier, AND its driver pays for her stay, the exit barrier MUST OPEN and its traffic light MUST become GREEN. Then, as long as no car PASSES THROUGH the exit barrier, after 3 seconds, the exit traffic light MUST become RED, and another 1 second later (= 4 seconds since the driver's payment), the exit barrier MUST CLOSE.

      Note: If the driver misses the 4-second window to pass through the opened barrier, the only way to open it again is to pay again.

      Note: This behavior is not very realistic, but it results in a sufficiently hard, but not too hard, assignment.

    R4. Whenever a car is PASSING THROUGH the exit barrier, its traffic light MUST become RED.

      Motivation: This RED signal is meant for a potential follow-up car.

    R5. Whenever a car has PASSED the exit barrier, the barrier must CLOSE.

      Motivation: only drivers that payed the fee are allowed to exit the parking lot.

#### Special Exit Procedure: Manual Overrride

    R6. When the parking lot operator clicks the "FORCE-OPEN EXIT"-button, the exit barrier MUST OPEN as if a driver has just payed for her stay (see R3), meaning, the car has 4 seconds to pass through the exit barrier, etc.

#### Safety

    R7. Whenever a car is PASSING THROUGH a barrier, that barrier MUST NEVER CLOSE.

      Motivation: safety: a barrier closing while a car passes through results in an accident (try it :)

### Plant <-> Statechart Interface

The Statechart model that you will create can respond to the following input events:

  - `s0(True|False)` indicates a change in the s0 sensor reading (`True`: car detected, `False`: no car detected)
  - `s1(True|False)` indicates a change in the s1 sensor reading (True: car detected, False: no car detected)
  - `s2(True|False)` indicates a change in the s2 sensor reading (True: car detected, False: no car detected)
  - `s3(True|False)` indicates a change in the s3 sensor reading (True: car detected, False: no car detected)
  - `forceExit` indicates the parking lot operator has clicked the "FORCE-OPEN EXIT" button
  - `full` indicates the parking lot has no more free spots
  - `notFull` indicates the parking lot has at least one free spot again
  - `payed` indicates a driver has payed the fee at the payment machine located at the exit


The Statechart model that you will create can raise the following output events:

  - `carsInc` increments the number of counted cars (potentially resulting in a `full` event being received)
  - `carsDec` decrements the number of counted cars (resulting in a `notFull` event being received if the parking lot was full)
  - `setEntryBarrier(True|False)` opens or closes the entrance barrier (`True`: open, `False`: close)
  - `setExitBarrier(True|False)` opens or closes the exit barrier (`True`: open, `False`: close)
  - `setEntryGreen` sets entrance traffic light to green
  - `setEntryRed` sets entrance traffic light to red
  - `setExitGreen` sets exit traffic light to green
  - `setExitRed` sets exit traffic light to red
  - `requestPay(Integer)` makes the payment machine request the given amount of money (in EUR) from the driver. This event must be raised before the driver can make her payment.

## Practical

We'll use StateBuddy, a web-based integrated environment for statechart modeling and simulation.

A starting point model is provided, where all input/output events have already been declared for you, and connections between these events and the 'plant' have already been set up.
It also contains a (wrong) example solution that you can play around with to become comfortable with StateBuddy.

Use Firefox or Chrome!! For instance, Safari is known to have issues resulting in DATA LOSS.

[***LINK TO STARTING POINT***](https://deemz.org/public/statebuddy/v2/?spy=1#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)

### What is Expected

The assignment is designed to encourage and/or require use of (almost) all the Statechart constructs that you have seen in the theory classes:
  - hierarchy
  - orthogonality
  - input/internal/output events
  - entry/exit actions
  - timed transitions

Use these features where appropriate, demonstrating that you understand them.

There is not a single correct solution and there can be many good solutions. Generally speaking, a smaller/elegant solution (fewer model elements) is preferred over a "big" solution. As an indication of expected size/complexity, my own solution contains 17 AND-states, 10 OR-states and 19 transitions.

### Collecting Usage Data

StateBuddy records all user interactions (mouse cursor movements, button clicks, ...)
This information remains local on your machine, but you can VOLUNTARILY hand it in, as it provides us with useful data to improve StateBuddy (what do students struggle with, etc.).
To do so, hit the shortcut Ctrl+. (dot). This freezes the app and brings up a bar at the bottom with a slider and some buttons:

![](./figures/export-recording.png)

Click the bottom-rightmost button ("export recording") to download the recording as a file. A recording can also be imported into StateBuddy to replay it (with the "import recording" button next to it). DO NOT refresh the page as you will lose your current recording. If you must close the page, export the recording, and import it later and click the "resume app" button to continue working.

It is also a small experiment to see if recording user interactions works well enough (e.g., doesn't slow down the app too much).

### Submitting Your Solution

Either:
 - If you wish to submit the full recording, simply upload the exported recording file (it contains your solution as well...)
 - If you do *not* wish to submit the full recording (e.g., privacy reasons), and only your solution, simply upload a file containing the URL (including the long hash-string).

And:
  - Upload a PDF document where you answer the following questions:
      1. Did you have hands-on experience with Statecharts modeling before? (e.g., Itemis CREATE)
      2. How much effort did it take to complete the exercise? Scale: 1 (very low) - 7 (very high) What made it easy or hard?
      3. Is there a feature/aspect of StateBuddy that you found especially useful?
      4. Is there a feature/aspect of StateBuddy that you found especially problematic?

    Elaborate where necessary.

## Resources

 - [StateBuddy manual](https://deemz.org/git/research/statebuddy/src/branch/master/docs/readme.md)
 - [Example models](https://deemz.org/git/research/statebuddy/src/branch/master#try-it-now)
