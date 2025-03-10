// Global variables
let dashboardData = null;
let currentPage = 1;
let pageSize = 10;
let weeklyChart = null;
let phaseChart = null;
let currentPhase = 1;
let currentDataType = 'count';
let useLogScale = false;

// Fetch and load the data
async function loadData() {
    try {
        const response = await fetch('static/data.json');
        if (!response.ok) {
            throw new Error('Failed to load data');
        }
        
        dashboardData = await response.json();
        
        // Initialize the dashboard
        updateSummaryStats();
        initializePhaseChart();
        initializeWeeklyChart();
        updateTable();
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.body.innerHTML = `<div class="alert alert-danger">
            Failed to load data: ${error.message}. Make sure you've run the Python script to generate the data file.
        </div>`;
    }
}

// Update summary statistics
function updateSummaryStats() {
    document.getElementById('total-protests').textContent = dashboardData.total_protests.toLocaleString();
    document.getElementById('total-protesters').textContent = dashboardData.total_protesters.toLocaleString();
    
    // Get the top state
    const topState = Object.entries(dashboardData.top_states)[0];
    document.getElementById('top-state').textContent = `${topState[0]} (${topState[1]})`;
}


// Initialize the weekly protest chart
function initializeWeeklyChart() {
    const ctx = document.getElementById('weekly-chart').getContext('2d');
    
    // Prepare data for the chart
    const dates = dashboardData.weekly_counts.map(item => item.start_date);
    const counts = dashboardData.weekly_counts.map(item => item.count);
    const protesterCounts = dashboardData.weekly_counts.map(item => item.protester_count);
    
    // Create the chart
    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Number of Protests',
                data: counts,
                backgroundColor: 'rgba(52, 58, 64, 0.2)',
                borderColor: 'rgba(52, 58, 64, 1)',
                borderWidth: 1,
                pointRadius: 0,
                pointHitRadius: 10,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 20,
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    type: 'linear'
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
    
    // Add event listeners for chart controls
    document.querySelectorAll('input[name="dataType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentDataType = this.value;
            updateWeeklyChart();
        });
    });
    
    document.getElementById('logScale').addEventListener('change', function() {
        useLogScale = this.checked;
        updateWeeklyChart();
    });
}

// Update the weekly chart based on selected options
function updateWeeklyChart() {
    const dates = dashboardData.weekly_counts.map(item => item.start_date);
    
    // Get the appropriate data based on selection
    let data, label;
    if (currentDataType === 'count') {
        data = dashboardData.weekly_counts.map(item => item.count);
        label = 'Number of Protests';
    } else {
        data = dashboardData.weekly_counts.map(item => item.protester_count);
        label = 'Number of Protesters';
    }
    
    // Update chart data
    weeklyChart.data.datasets[0].data = data;
    weeklyChart.data.datasets[0].label = label;
    
    // Update scale type
    weeklyChart.options.scales.y.type = useLogScale ? 'logarithmic' : 'linear';
    
    // If using log scale, ensure we don't have zero values
    if (useLogScale) {
        weeklyChart.options.scales.y.min = Math.max(1, Math.min(...data.filter(val => val > 0)));
    } else {
        weeklyChart.options.scales.y.min = 0;
    }
    
    weeklyChart.update();
}

// Initialize the phased visualization chart
function initializePhaseChart() {
    const ctx = document.getElementById('phase-chart').getContext('2d');
    
    // Initial data for Phase 1
    const months = dashboardData.phase1_monthly.map(item => item.month);
    const counts = dashboardData.phase1_monthly.map(item => item.count);
    
    // Create the chart
    phaseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Number of Protests',
                data: counts,
                backgroundColor: '#ffffbf', // Light yellow for Phase 1
                borderColor: '#d9d99e', // Darker border
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
    
    // Add event listeners for phase navigation
    document.getElementById('next-phase').addEventListener('click', () => {
        if (currentPhase < 3) {
            currentPhase++;
            updatePhaseChart();
        }
    });
    
    document.getElementById('prev-phase').addEventListener('click', () => {
        if (currentPhase > 1) {
            currentPhase--;
            updatePhaseChart();
        }
    });
}

// Update the phase chart based on current phase
function updatePhaseChart() {
    // Update navigation buttons
    document.getElementById('prev-phase').disabled = (currentPhase === 1);
    document.getElementById('next-phase').disabled = (currentPhase === 3);
    
    // Update title and description
    const titleElement = document.getElementById('phase-title');
    const descriptionElement = document.getElementById('phase-description');
    
    let data, labels, chartType;
    
    switch(currentPhase) {
        case 1:
            // Phase 1: Pre-Floyd monthly data
            titleElement.textContent = 'The Story of Police Brutality Protests: Phase 1';
            descriptionElement.textContent = 'Monthly protest counts before George Floyd\'s death (up to April 2020).';
            
            data = dashboardData.phase1_monthly.map(item => item.count);
            labels = dashboardData.phase1_monthly.map(item => item.month);
            chartType = 'bar';
            break;
            
        case 2:
            // Phase 2: Floyd protest surge (May-Oct 2020)
            titleElement.textContent = 'The Story of Police Brutality Protests: Phase 2';
            descriptionElement.textContent = 'The surge in protests following George Floyd\'s death (May-October 2020).';
            
            // Combine phase 1 and 2 data to show the dramatic increase
            const phase1Data = dashboardData.phase1_monthly;
            const phase2Data = dashboardData.phase2_monthly;
            
            // Create a combined dataset with all months
            const allMonths = [...new Set([
                ...phase1Data.map(item => item.month),
                ...phase2Data.map(item => item.month)
            ])].sort();
            
            // Create a lookup for counts
            const countLookup = {};
            phase1Data.forEach(item => { countLookup[item.month] = item.count });
            phase2Data.forEach(item => { countLookup[item.month] = item.count });
            
            labels = allMonths;
            data = allMonths.map(month => countLookup[month] || 0);
            
            // Highlight the Floyd protest period
            const backgroundColors = allMonths.map(month => {
                if (month >= '2020-05' && month <= '2020-10') {
                    return '#fc8d59'; // Orange-red for Floyd period
                }
                return '#ffffbf'; // Light yellow for pre-Floyd period
            });
            
            phaseChart.data.datasets[0].backgroundColor = backgroundColors;
            chartType = 'bar';
            break;
            
        case 3:
            // Phase 3: Weekly data since November 2020
            titleElement.textContent = 'The Story of Police Brutality Protests: Phase 3';
            descriptionElement.textContent = 'Weekly protest counts since November 2020 to present.';
            
            data = dashboardData.phase3_weekly.map(item => item.count);
            labels = dashboardData.phase3_weekly.map(item => item.start_date);
            chartType = 'line';
            break;
    }
    
    // Update chart type if needed
    if (phaseChart.config.type !== chartType) {
        phaseChart.destroy();
        
        phaseChart = new Chart(document.getElementById('phase-chart').getContext('2d'), {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Protests',
                    data: data,
                    backgroundColor: currentPhase === 3 ? 'rgba(145, 191, 219, 0.2)' : 
                                    (currentPhase === 2 ? '#fc8d59' : '#ffffbf'),
                    borderColor: currentPhase === 3 ? '#91bfdb' : 
                               (currentPhase === 2 ? '#e67e4d' : '#d9d99e'),
                    borderWidth: 1,
                    pointRadius: chartType === 'line' ? 0 : undefined,
                    pointHitRadius: chartType === 'line' ? 10 : undefined,
                    tension: chartType === 'line' ? 0.1 : undefined
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            maxTicksLimit: chartType === 'line' ? 20 : undefined
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    } else {
        // Just update the data
        phaseChart.data.labels = labels;
        phaseChart.data.datasets[0].data = data;
        
        // Set appropriate colors for each phase
        if (currentPhase === 1) {
            phaseChart.data.datasets[0].backgroundColor = '#ffffbf'; // Light yellow for Phase 1
            phaseChart.data.datasets[0].borderColor = '#d9d99e';
        } else if (currentPhase === 3) {
            phaseChart.data.datasets[0].backgroundColor = chartType === 'line' ? 'rgba(145, 191, 219, 0.2)' : '#91bfdb'; // Blue for Phase 3
            phaseChart.data.datasets[0].borderColor = '#91bfdb';
        }
        
        phaseChart.update();
    }
}

// Update the data table
function updateTable() {
    const tableBody = document.getElementById('data-table-body');
    const pagination = document.getElementById('pagination');
    
    // Calculate pagination
    const totalPages = Math.ceil(dashboardData.table_data.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, dashboardData.table_data.length);
    
    // Clear the table
    tableBody.innerHTML = '';
    
    // Add data rows
    for (let i = startIndex; i < endIndex; i++) {
        const protest = dashboardData.table_data[i];
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${protest.date}</td>
            <td>${protest.locality}</td>
            <td>${protest.state}</td>
            <td>${protest.type}</td>
            <td>${protest.claims}</td>
            <td>${protest.size_mean}</td>
        `;
        
        tableBody.appendChild(row);
    }
    
    // Update pagination
    updatePagination(totalPages);
}

// Update pagination controls
function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
    </a>`;
    prevLi.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            updateTable();
        }
    });
    pagination.appendChild(prevLi);
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        pageLi.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            updateTable();
        });
        pagination.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
    </a>`;
    nextLi.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            updateTable();
        }
    });
    pagination.appendChild(nextLi);
}

// Handle page size changes
document.getElementById('page-size').addEventListener('change', function() {
    pageSize = parseInt(this.value);
    currentPage = 1; // Reset to first page
    updateTable();
});

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', loadData);
