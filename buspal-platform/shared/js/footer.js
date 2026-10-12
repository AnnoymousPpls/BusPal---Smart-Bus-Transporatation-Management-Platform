function loadBusPalFooter() {

    const footer = document.createElement("footer");

    footer.className = "buspal-footer";

    footer.innerHTML = `

    <div class="footer-main">


        <div class="footer-brand">

            <div class="footer-logo">
                <img src="../shared/assets/logo.png" alt="BusPal">
                <h3>BusPal</h3>
            </div>


            <p>
                Smart Bus Transportation Platform.
                Making every journey safer, easier and more connected
                with digital booking, live tracking and passenger support.
            </p>


            <div class="footer-trust">

                <span>
                    🚍 Digital Booking
                </span>

                <span>
                    📍 Live Tracking
                </span>

                <span>
                    🆘 Emergency Support
                </span>

            </div>


        </div>



        <div class="footer-column">

            <h4>Quick Links</h4>


            <a href="#" data-route="overview">
                Overview
            </a>


            <a href="#" data-route="book">
                Book a Trip
            </a>


            <a href="#" data-route="bookings">
                My Bookings
            </a>


            <a href="#" data-route="tracking">
                Live Tracking
            </a>


        </div>




        <div class="footer-column">

            <h4>Support</h4>


            <a href="#">
                Help Centre
            </a>


            <a href="#" data-route="support">
                Report Issue
            </a>


            <a href="#" data-route="support">
                Emergency SOS
            </a>


            <a href="#">
                Privacy Policy
            </a>


        </div>




        <div class="footer-column">

            <h4>Contact</h4>


            <p>
                📞 +94 70 XXX XXXX
            </p>


            <p>
                ✉ support@buspal.lk
            </p>


            <p>
                📍 Sri Lanka
            </p>



            <div class="footer-social">

                <a href="#">
                    ◉
                </a>

                <a href="#">
                    ◎
                </a>

                <a href="#">
                    ◌
                </a>


            </div>


        </div>



    </div>




    <div class="footer-bottom">


        <span>
            © 2026 BusPal. All rights reserved.
        </span>


        <span>
            Smart Bus Transportation System
        </span>


    </div>


    `;



    document.body.appendChild(footer);



    /*
      Connect footer navigation
      with existing dashboard routing
    */

    footer.querySelectorAll("[data-route]").forEach(link => {


        link.addEventListener("click", function(e){


            e.preventDefault();


            const route = this.dataset.route;


            const button = document.querySelector(
                `.nav-item[data-route="${route}"]`
            );


            if(button){
                button.click();
            }


        });


    });



}



document.addEventListener(
    "DOMContentLoaded",
    loadBusPalFooter
);