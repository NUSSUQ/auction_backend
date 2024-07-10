document.addEventListener('DOMContentLoaded', () => {
    const toggleSidebarButton = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    // Function to update the UI based on the sidebar state
    const updateSidebarState = (isOpen) => {
        if (isOpen) {
            sidebar.classList.remove('out');
            mainContent.classList.add('md:pr-64');
        } else {
            sidebar.classList.add('out');
            mainContent.classList.remove('md:pr-64');
        }
    };

    // Load the sidebar state from localStorage and apply it
    const sidebarState = localStorage.getItem('sidebarOpen') === 'true';
    updateSidebarState(sidebarState);

    toggleSidebarButton.addEventListener('click', () => {
        const isSidebarOpen = sidebar.classList.toggle('out');
        mainContent.classList.toggle('md:pr-64');

        // Save the sidebar state to localStorage
        localStorage.setItem('sidebarOpen', !isSidebarOpen);
    });
});

// Function to create an alert with options
function createAlert(type, title, message, duration, showIcon = false) {
    // Create the alert element
    const alert = document.createElement('div');
    alert.classList.add('alert', `alert-${type}`);
    alert.setAttribute('role', 'alert');

    // Construct the alert content
    alert.innerHTML = `
        ${showIcon ? `
        <i class="fas fa-${getIcon(type)}"></i>` : ''}
        <div>
            <p class="font-bold">${title}</p>
            <p class="text-sm">${message}</p>
        </div>
    `;

    // Append the alert to the container
    document.getElementById('alertContainer').appendChild(alert);

    // Hide the alert with animation after the specified duration
    setTimeout(function () {
        alert.classList.add('hide-animation');
    }, duration);
    // Remove the alert from HTML after the animation duration
    setTimeout(function () {
        alert.remove();
    }, duration + 600);
}

// Function to get Font Awesome icon based on alert type
function getIcon(type) {
    switch (type) {
        case 'success':
            return 'check-circle';
        case 'error':
            return 'exclamation-circle';
        case 'info':
            return 'info-circle';
        default:
            return 'bell';
    }
}