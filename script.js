'use strict';

//////////////////////////////////////////////////
/// --- --- APP --- --- /////////////////////////
/////////////////////////////////////////////////
/// --- GEOLOCATION API and how to use it --- ///

/// --- Managing workout data: Creating classes --- ///
// Getting the workout data and creating the classes in the architecture diagram with the Workout Class and the cycling and running subclasses > look at diagram
// Parent Class
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // mins
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  giveClicks() {
    this.clicks++;
    // console.log(this.clicks);
  }
}

// Child classes

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;

    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // Pace = min / km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//Testing if our classes work

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);

// // console.log(run1, cycling1);

///////////////////////////////////////////
///////// APPLICATION ARCHITECTURE ///////
/////////////////////////////////////////

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  /// - Adding private properties
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  /// - The constructor method is called immediately when creating a new class - calling the getPosition function here loads the page -> getPosition in turn calls the loadMap function as well - at this point the code works

  constructor() {
    // Get user position
    this._getPosition();
    // Get data from local storage

    this._getLocaleStorage();

    /// - We attach our eventlisteners in the constructor function
    // - This is an event handler function -> the this keyword in an event handler function is the DOM element on which the handler is attached to in this case, the form element
    // - This is a pain in event handlers with classes, always bind the this keyword to the class
    form.addEventListener('submit', this._newWorkout.bind(this));

    // Changing between Cadence and elevation gain in the form input field of the app between running and cycling
    inputType.addEventListener('change', this._toggleElevationField);

    // Adding move to marker on click functionality - using event delegation for when there is no item to attach a listener to yet

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    // This method calls the API and takes as an input two callback functions, the first callback function will be called on success, whenever the browser got the current position of the user and the second callback is the error callback, which gets called whenever there was an error getting the position

    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position!');
        }
      );
  }
  _loadMap(position) {
    //  Logs to the console an object called GeoLocationPosition, which has an inner object that contains another nested object called (coords) which has details about the position of the device on the browser
    //   console.log(position);

    // Using destructuring to get the latitude and longitude properties of the coords object
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // Using the google maps to create a custom link with the variables we just generated
    //   console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    //   Code to integrate map in the app, the string in the map function has to be the ID of some html where we want the map to be displayed, in our case the last div in the html with the map
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot//{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //   Special object with special methods and properties from the leaflet library --> works like a special addEventListener, they used the prototype chain heavily to add their own methods on this opensource projects
    // /// // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // we have to call this method here cause when the page loads the map is not fully loaded  so the marker can't be placed
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }
  _showForm(mapE) {
    this.#mapEvent = mapE;
    // console.log(mapEvent); //Object that has a nested object (latlng) with the coordinates on the map where the click happened
    ////////////////////////////////////////////
    /// --- Rendering Workout Input Form --- ///
    form.classList.remove('hidden');
    // User experience enhancer, focuses the distance form in order to be able to type straight away
    inputDistance.focus();
  }

  _hideForm() {
    //   Empty the inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        ' ';
    // Add the classlist back

    form.style.display = 'none';
    form.classList.add('hidden');

    // Small workaround cheat
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    // Displaying the marker
    const { lat, lng } = this.#mapEvent.latlng; // destructuring the click coords

    let workout;

    // If activity running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      //   Guard clause

      // !Number.isFinite(distance) ||
      // !Number.isFinite(duration) ||
      // !Number.isFinite(cadence)
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // If activity cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)

        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array

    this.#workouts.push(workout);
    console.log(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);
    // Render workout on list
    this._renderWorkout(workout);
    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts

    this._setLocalStorage();
  }

  // Displaying the marker

  // The code to create a marker on the map, now dynamically created to appear wherever a click event is happening on the map

  // Read documentation of the libraries you are using!! e.g. L.popup() method using it we're creating a custom popup for each marker
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    if (workout.type === 'running')
      html += `<div class="workout__details">
             <span class="workout__icon">⚡️</span>
             <span class="workout__value">${workout.pace.toFixed(1)}</span>
             <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">🦶🏼</span>
             <span class="workout__value">178</span>
             <span class="workout__unit">spm</span>
            </div>
         </li>`;
    if (workout.type === 'cycling')
      html += `<div class="workout__details">
         <span class="workout__icon">⚡️</span>
         <span class="workout__value">${workout.speed.toFixed(1)}</span>
         <span class="workout__unit">km/h</span>
       </div>
       <div class="workout__details">
         <span class="workout__icon">⛰</span>
         <span class="workout__value">${workout.elevationGain}</span>
         <span class="workout__unit">m</span>
       </div>
     </li>`;

    // Add the dynamically generated HTML as a sibling to the form after the form html has ended
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    // We get the entire li with the class of workout no matter where we press on the rectangle with the workout
    // console.log(workoutEl);
    // Guard Clause
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // console.log(workout);

    // Leaflet method

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // Using the public interface

    // workout.giveClicks();
  }
  _setLocalStorage() {
    //   How to use the locale storage API
    // local storage -> (key, value store)
    // Don't use local storage to store large ammounts of data
    localStorage.setItem('workout', JSON.stringify(this.#workouts));
  }
  _getLocaleStorage() {
    const data = JSON.parse(localStorage.getItem('workout'));

    // Guard Clause
    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workout');
    location.reload();
  }
}

const app = new App();

/// --- Suggestions and final considerations for the mapty project --- /// --- Challenges
/**
 * - Ability to edit a workout;
 * - Ability to delete a workout;
 * - Ability to delete all workouts;
 *
 * - Ability to sort workouts by a certain field(e.g. distance) - inspire from the Bankist app
 *
 * - Re-build Running and Cycling objects coming from Local Storage
 *
 *
 * - More realistic error and confirmation messages; (Maybe have them fade out after some time)
 *
 * HARD: //
 *
 * Ability to position the map to show all workouts [very hard]
 *
 * Ability to draw lines and shapes instead of just points [very hard]
 *
 * Geocode location from coordinates("Run in Faro, Portugal") [only after asynchronous JavaScript section]
 *
 * Display weather data for workout time and place [only after asynchronous JavaScript section]
 */

/// --- Displaying a Map Using Leaflet Library --- ///
// -- https://leafletjs.com/
//
//
//
//
//
//
//
//

//////////////////////////////////////
//////////////////////////////////////
/// --- How to plan a project --- /// /// - LECTURES
////////////////////////////////////

/// --- Project Overview --- ///
// How to plan a web project !

/*
 * Always start with a planning phase before starting any project !!
 *
 * 1. User stories: Description of the application's functionality from the  user's perspective. All user stories put  together describe the entire application
 *
 * Common format: As a [type of user: Who?], I want [an action: What?] so that [a benefit: Why?].
 *
 * Example for Mapty app (1) //: As a user, I want to log my running workouts with location, distance, time, pace and steps/minute, so i can keep a log of all my running.
 *      (2): As a user, I want to log my cycling workouts with location, distance, time, speed and elevation gain, so i can keep a log of all my cycling.
 *      (3): As a user, I want to see all my workouts at a glance, so I can easily track my progress over time.
 *
 *      (4): As a user, I want to also see my workouts on a map, so I can easily check where i work out the most.
 *
 *      (5): As a user, I want to see all my workouts when i leave the app and come back later, so that i can keep using the app over time.
 *
 *
 * (6: Optional for myself: Insert a step count as well for walking)
 * \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 * 2. Features: We visualise them based on the user stories in step one
 *  From the user stories to features:
 *  (1) - Map where user clicks to add new workout (best way to get location coordinates)
 *      - Geolocation to display map at current location (more user friendly)
 *      - Form to input distance, time, speed, elevation gain
 *  \\
 *  (2) - Form to input distance, time, speed, elevation gain
 *  \\
 *  (3) - Display all workouts in a list
 *  \\
 *  (4) - Display all workouts on the map
 *  \\
 *  (5) - Store workout data in the browser using local storage API
 *      - On page load, read the saved data from local storage and display
 *  \\
 *  (6)
 *  \\ * //////////////////////////////////////////////
 * 3. Flowchart : We encapsulate the features in the flowchart deciding the best and most logical order. this the last step of the (WHAT we will build process) (In the real-world, you don't have to come with the final flowchart right in the planning phase. It's normal that it changes throughout implementation)
 *
 * 4. Architecture: This is the first step of the (HOW) we will build it, gives a structure in which we can develop the app and its functionality and how to do it. (The final step of the entire planning step)
 *
 * 5. Development Step : Implementation of our plan using code
 *
 * */

/// --- Architecture: Initial approach --- ///

// User stories

// Based on the following two user stories we will construct a class Based system that inherits and has the relevant methods and properties for each type of action required as well as an App Class that stores all the workouts as well as methods we already defined structured like loading pace, receive position, click on map, change input and submit form

// (1). Log my running workouts with location, distance, time, pace and steps/minute (cadence)

// (2). Log my cycling workouts with location, distance, time, speed and elevation gain
