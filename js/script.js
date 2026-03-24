// ================= LOADER =================
function loader() {
   const loaderEl = document.querySelector('.loader');
   if (loaderEl) loaderEl.style.display = 'none';
}

function fadeOut() {
   setInterval(loader, 2000);
}

window.onload = fadeOut;


// ================= INPUT LIMIT =================
document.querySelectorAll('input[type="number"]').forEach(numberInput => {
   numberInput.oninput = () => {
      if (numberInput.value.length > numberInput.maxLength) {
         numberInput.value = numberInput.value.slice(0, numberInput.maxLength);
      }
   };
});


// ================= PAYMENT DROPDOWN =================
document.addEventListener('DOMContentLoaded', function () {

   const paymentOptions = document.querySelectorAll('.dropdown-content .payment-option');
   const dropdownButton = document.querySelector('.dropdown-button');

   if (!paymentOptions.length || !dropdownButton) return;

   paymentOptions.forEach(option => {

      option.addEventListener('click', function () {

         paymentOptions.forEach(opt => opt.classList.remove('active'));

         option.classList.add('active');

         dropdownButton.innerHTML =
            '<i class="fas fa-caret-down"></i> ' + option.innerHTML;

      });

   });

});