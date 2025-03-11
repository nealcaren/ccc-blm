// Global variables
let dashboardData = null;
let currentPage = 1;
let pageSize = 10;
let weeklyChart = null;
let phaseChart = null;
let currentPhase = 1;
let currentDataType = 'count';
let currentPhaseDataType = 'count';
let useLogScale = false;

// Fetch and load the data
async function loadData() {
    try {
        const response = await fetch('static/data.json');
        if (!response.ok) {
            throw new Error('Failed to load data');
        }
        
        dashboardData = await response.json();
        
        // Log data structure for debugging
        console.log('Data loaded:', dashboardData);
        console.log('Phase 1 sample:', dashboardData.phase1_monthly[0]);
        console.log('Phase 2 sample:', dashboardData.phase2_monthly[0]);
        console.log('Phase 3 sample:', dashboardData.phase3_monthly[0]);
        console.log('Phase 5 sample:', dashboardData.phase5_monthly[0]);
        console.log('Phase 6 sample:', dashboardData.phase6_monthly[0]);
        
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
                    display: false
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
                backgroundColor: '#1b9e77', // Green for Phase 1
                borderColor: '#1b9e77', // Darker border
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
    
    // Add event listeners for phase navigation and data type
    document.getElementById('next-phase').addEventListener('click', () => {
        if (currentPhase < 6) {
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
    
    // Add event listeners for phase data type
    document.querySelectorAll('input[name="phaseDataType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            console.log('Phase data type changed to:', this.value);
            currentPhaseDataType = this.value;
            updatePhaseChart();
        });
    });
    
    // Initial call to set up the chart with the default data type
    updatePhaseChart();
}

// Update the phase chart based on current phase
function updatePhaseChart() {
    // Update navigation buttons
    document.getElementById('prev-phase').disabled = (currentPhase === 1);
    document.getElementById('next-phase').disabled = (currentPhase === 6);
    
    // Update title and description
    const titleElement = document.getElementById('phase-title');
    const descriptionElement = document.getElementById('phase-description');
    
    let data, labels, chartType, backgroundColors;
    // For protester count, we'll use the size field from our data
    const dataField = currentPhaseDataType === 'count' ? 'count' : 'size';
    const dataLabel = currentPhaseDataType === 'count' ? 'Number of Protests' : 'Total Protesters';
    
    console.log('Using data field:', dataField);
    
    // Prepare data based on current phase
    if (currentPhase === 1) {
        // Phase 1: Beginning until July 2014
        titleElement.textContent = 'The Story of Police Brutality Protests: Phase 1';
        const countType = currentPhaseDataType === 'count' ? 'protest counts' : 'protester counts';
        descriptionElement.textContent = `Monthly ${countType} from the beginning until July 2014.`;
        
        // Use the data field directly from our processed data
        data = dashboardData.phase1_monthly.map(item => item[dataField] || 0);
        labels = dashboardData.phase1_monthly.map(item => item.month);
        chartType = 'bar';
        backgroundColors = '#1b9e77'; // Green for Phase 1
        
    } else if (currentPhase === 2) {
        // Phase 2: August 2014 until December 2016
        titleElement.textContent = 'The Story of Police Brutality Protests: Phase 2';
        const countType = currentPhaseDataType === 'count' ? 'protest counts' : 'protester counts';
        descriptionElement.textContent = `Monthly ${countType} through December 2016, including earlier data.`;
        
        // Combine phase 1 and 2 data to show the progression
        const phase1Data = dashboardData.phase1_monthly;
        const phase2Data = dashboardData.phase2_monthly;
        
        // Create a combined dataset with all months
        const allMonths = [...new Set([
            ...phase1Data.map(item => item.month),
            ...phase2Data.map(item => item.month)
        ])].sort();
        
        // Create a lookup for counts
        const countLookup = {};
        
        // Helper function to set count lookup values
        const setCountValue = (item) => {
            countLookup[item.month] = item[dataField] || 0;
        };
        
        phase1Data.forEach(setCountValue);
        phase2Data.forEach(setCountValue);
        
        labels = allMonths;
        data = allMonths.map(month => countLookup[month] || 0);
        
        // Color-code by period
        backgroundColors = allMonths.map(month => {
            if (month <= '2014-07') {
                return '#1b9e77'; // Green for Phase 1
            } else {
                return '#d95f02'; // Orange for Phase 2
            }
        });
        
        chartType = 'bar';
        
    } else if (currentPhase === 3) {
        // Phase 3: January 2017 until April 2020
        titleElement.textContent = 'The Story of Police Brutality Protests: Phase 3';
        const countType = currentPhaseDataType === 'count' ? 'protest counts' : 'protester counts';
        descriptionElement.textContent = `Monthly ${countType} through April 2020, including earlier data.`;
        
        // Combine phase 1, 2, and 3 data to show the progression
        const phase1Data = dashboardData.phase1_monthly;
        const phase2Data = dashboardData.phase2_monthly;
        const phase3Data = dashboardData.phase3_monthly;
        
        // Create a combined dataset with all months
        const allMonths = [...new Set([
            ...phase1Data.map(item => item.month),
            ...phase2Data.map(item => item.month),
            ...phase3Data.map(item => item.month)
        ])].sort();
        
        // Create a lookup for counts
        const countLookup = {};
        
        // Helper function to set count lookup values
        const setCountValue = (item) => {
            countLookup[item.month] = item[dataField] || 0;
        };
        
        phase1Data.forEach(setCountValue);
        phase2Data.forEach(setCountValue);
        phase3Data.forEach(setCountValue);
        
        labels = allMonths;
        data = allMonths.map(month => countLookup[month] || 0);
        
        // Color-code by period
        backgroundColors = allMonths.map(month => {
            if (month <= '2014-07') {
                return '#1b9e77'; // Green for Phase 1
            } else if (month > '2014-07' && month <= '2016-12') {
                return '#d95f02'; // Orange for Phase 2
            } else {
                return '#7570b3'; // Purple for Phase 3
            }
        });
        
        chartType = 'bar';
        
    } else if (currentPhase === 5) {
        // Phase 5: Floyd protest surge (May-Oct 2020)
        titleElement.textContent = 'The Story of Police Brutality Protests: Phase 5';
        const countType = currentPhaseDataType === 'count' ? 'protests' : 'protesters';
        descriptionElement.textContent = `The surge in ${countType} following George Floyd's death (May-October 2020), with historical context.`;
        
        // Combine all previous phases with phase 5 data to show the dramatic increase
        const phase1Data = dashboardData.phase1_monthly;
        const phase2Data = dashboardData.phase2_monthly;
        const phase3Data = dashboardData.phase3_monthly;
        const phase5Data = dashboardData.phase5_monthly;
        
        // Create a combined dataset with all months
        const allMonths = [...new Set([
            ...phase1Data.map(item => item.month),
            ...phase2Data.map(item => item.month),
            ...phase3Data.map(item => item.month),
            ...phase5Data.map(item => item.month)
        ])].sort();
        
        // Create a lookup for counts
        const countLookup = {};
        
        // Helper function to set count lookup values - now simplified
        const setCountValue = (item) => {
            countLookup[item.month] = item[dataField] || 0;
        };
        
        phase1Data.forEach(setCountValue);
        phase2Data.forEach(setCountValue);
        phase3Data.forEach(setCountValue);
        phase5Data.forEach(setCountValue);
        
        labels = allMonths;
        data = allMonths.map(month => countLookup[month] || 0);
        
        // Color-code by period
        backgroundColors = allMonths.map(month => {
            if (month <= '2014-07') {
                return '#1b9e77'; // Green for Phase 1
            } else if (month > '2014-07' && month <= '2016-12') {
                return '#d95f02'; // Orange for Phase 2
            } else if (month > '2016-12' && month <= '2020-04') {
                return '#7570b3'; // Purple for Phase 3
            } else {
                return '#e7298a'; // Pink for Phase 5 (Floyd period)
            }
        });
        
        chartType = 'bar';
        
    } else if (currentPhase === 6) {
        // Phase 6: All data with color coding by period
        titleElement.textContent = 'The Story of Police Brutality Protests: Phase 6';
        const countType = currentPhaseDataType === 'count' ? 'protest counts' : 'protester counts';
        descriptionElement.textContent = `Monthly ${countType} across all periods, color-coded by phase.`;
        
        // Combine all phase data to show the complete timeline
        const phaseData = {
            phase1: dashboardData.phase1_monthly,
            phase2: dashboardData.phase2_monthly,
            phase3: dashboardData.phase3_monthly,
            phase5: dashboardData.phase5_monthly,
            phase6: dashboardData.phase6_monthly
        };
        
        // Create a combined dataset with all months
        const allMonths = [...new Set([
            ...phaseData.phase1.map(item => item.month),
            ...phaseData.phase2.map(item => item.month),
            ...phaseData.phase3.map(item => item.month),
            ...phaseData.phase5.map(item => item.month),
            ...phaseData.phase6.map(item => item.month)
        ])].sort();
        
        // Create a lookup for counts
        const countLookup = {};
        
        // Helper function to handle protester count data - now simplified
        const setCountLookup = (item) => {
            countLookup[item.month] = item[dataField] || 0;
        };
        
        phaseData.phase1.forEach(setCountLookup);
        phaseData.phase2.forEach(setCountLookup);
        phaseData.phase3.forEach(setCountLookup);
        phaseData.phase5.forEach(setCountLookup);
        phaseData.phase6.forEach(setCountLookup);
        
        labels = allMonths;
        data = allMonths.map(month => countLookup[month] || 0);
        
        // Color-code by period
        backgroundColors = allMonths.map(month => {
            if (month <= '2014-07') {
                return '#1b9e77'; // Green for Phase 1
            } else if (month > '2014-07' && month <= '2016-12') {
                return '#d95f02'; // Orange for Phase 2
            } else if (month > '2016-12' && month <= '2020-04') {
                return '#7570b3'; // Purple for Phase 3
            } else if (month >= '2020-05' && month <= '2020-10') {
                return '#e7298a'; // Pink for Phase 5 (Floyd period)
            } else {
                return '#66a61e'; // Green-yellow for Phase 6 (post-Floyd period)
            }
        });
        
        chartType = 'bar';
    }
    
    // Update chart type if needed
    if (phaseChart.config.type !== chartType) {
        phaseChart.destroy();
        
        phaseChart = new Chart(document.getElementById('phase-chart').getContext('2d'), {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: dataLabel,
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: currentPhase === 3 ? '#7570b3' : 
                               (currentPhase === 2 ? '#d95f02' : '#1b9e77'),
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
                        display: false
                    }
                }
            }
        });
    } else {
        // Just update the data
        phaseChart.data.labels = labels;
        phaseChart.data.datasets[0].data = data;
        phaseChart.data.datasets[0].backgroundColor = backgroundColors;
        phaseChart.data.datasets[0].label = dataLabel;
        
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
