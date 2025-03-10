// Global variables
let dashboardData = null;
let currentPage = 1;
let pageSize = 10;
let weeklyChart = null;
let monthlyChart = null;
let selectedMonths = [];
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
        initializeWeeklyChart();
        initializeMonthlyChart();
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

// Custom plugin for broken axis
const breakAxisPlugin = {
    id: 'breakAxis',
    beforeDraw: (chart, args, options) => {
        if (!chart.options.plugins.breakAxis) return;
        
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        const settings = chart.options.plugins.breakAxisSettings || {};
        const breakValue = settings.breakValue || 500;
        const topSpaceRatio = settings.topSpaceRatio || 0.3;
        
        // Calculate the break position
        const yScale = chart.scales.y;
        const normalRange = chartArea.bottom - chartArea.top;
        const breakPosition = chartArea.bottom - normalRange * (1 - topSpaceRatio);
        
        // Draw the break markers
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#666';
        
        // Draw zigzag break line
        ctx.beginPath();
        const zigzagWidth = 10;
        const zigzagHeight = 8;
        let x = chartArea.left - 5;
        let y = breakPosition;
        
        ctx.moveTo(x, y);
        for (let i = 0; i < Math.ceil((chartArea.right - chartArea.left + 10) / zigzagWidth); i++) {
            y = breakPosition + ((i % 2) * zigzagHeight);
            x += zigzagWidth;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Adjust the scale
        const maxValue = Math.max(...chart.data.datasets[0].data);
        const minValue = 0;
        
        // Map values for display
        chart.data.datasets.forEach(dataset => {
            dataset._originalData = dataset._originalData || [...dataset.data];
            
            dataset.data = dataset._originalData.map(value => {
                if (value <= breakValue) {
                    // Values below break point are scaled normally
                    return value;
                } else {
                    // Values above break point are scaled to fit in the top section
                    const topRangeRatio = (value - breakValue) / (maxValue - breakValue);
                    return breakValue + (topRangeRatio * breakValue * topSpaceRatio / (1 - topSpaceRatio));
                }
            });
        });
        
        // Custom ticks for the broken scale
        yScale.options.ticks.callback = function(value) {
            if (value <= breakValue) {
                return value;
            } else {
                // Calculate the original value this represents
                const topRangeRatio = (value - breakValue) / (breakValue * topSpaceRatio / (1 - topSpaceRatio));
                const originalValue = breakValue + (topRangeRatio * (maxValue - breakValue));
                return Math.round(originalValue);
            }
        };
        
        ctx.restore();
    },
    afterDraw: (chart) => {
        if (!chart.options.plugins.breakAxis) {
            // Restore original data when not using broken axis
            chart.data.datasets.forEach(dataset => {
                if (dataset._originalData) {
                    dataset.data = [...dataset._originalData];
                }
            });
        }
    }
};

// Initialize the weekly protest chart
function initializeWeeklyChart() {
    const ctx = document.getElementById('weekly-chart').getContext('2d');
    
    // Register the custom plugin
    Chart.register(breakAxisPlugin);
    
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
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            
                            // Use original data for tooltip if available
                            if (context.dataset._originalData && 
                                context.dataIndex < context.dataset._originalData.length) {
                                label += context.dataset._originalData[context.dataIndex];
                            } else {
                                label += context.parsed.y;
                            }
                            
                            return label;
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                breakAxis: true,
                breakAxisSettings: {
                    breakValue: 500,
                    topSpaceRatio: 0.3
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
    
    if (useLogScale) {
        // Log scale mode
        weeklyChart.options.scales.y.type = 'logarithmic';
        weeklyChart.options.scales.y.min = Math.max(1, Math.min(...data.filter(val => val > 0)));
        weeklyChart.options.plugins.breakAxis = false; // Disable break axis in log mode
    } else {
        // Linear scale with broken axis
        weeklyChart.options.scales.y.type = 'linear';
        weeklyChart.options.scales.y.min = 0;
        
        // Enable broken axis plugin
        weeklyChart.options.plugins.breakAxis = true;
        
        // Find a good break point - typically around 500 or based on data distribution
        const sortedData = [...data].sort((a, b) => a - b);
        const threshold = sortedData.length > 0 ? 
            Math.min(500, sortedData[Math.floor(sortedData.length * 0.95)]) : 500;
        
        // Set up the break configuration
        weeklyChart.options.plugins.breakAxisSettings = {
            breakValue: threshold,
            topSpaceRatio: 0.3, // 30% of chart height for values above threshold
        };
    }
    
    weeklyChart.update();
}

// Initialize the monthly protest chart with selection capability
function initializeMonthlyChart() {
    const ctx = document.getElementById('monthly-chart').getContext('2d');
    
    // Prepare data for the chart
    const months = dashboardData.monthly_counts.map(item => item.month);
    const counts = dashboardData.monthly_counts.map(item => item.count);
    
    // Create the chart
    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Number of Protests',
                data: counts,
                backgroundColor: 'rgba(52, 58, 64, 0.7)',
                borderColor: 'rgba(52, 58, 64, 1)',
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
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const month = months[index];
                    
                    // Toggle selection of this month
                    const monthIndex = selectedMonths.indexOf(month);
                    if (monthIndex === -1) {
                        selectedMonths.push(month);
                    } else {
                        selectedMonths.splice(monthIndex, 1);
                    }
                    
                    updateMonthlyChart();
                }
            }
        }
    });
    
    // Add event listener for reset button
    document.getElementById('reset-months').addEventListener('click', () => {
        selectedMonths = [];
        updateMonthlyChart();
    });
}

// Update the monthly chart based on selections
function updateMonthlyChart() {
    const months = dashboardData.monthly_counts.map(item => item.month);
    const counts = dashboardData.monthly_counts.map(item => item.count);
    
    // Update background colors based on selection
    const backgroundColors = months.map(month => 
        selectedMonths.length === 0 || selectedMonths.includes(month) 
            ? 'rgba(52, 58, 64, 0.7)' 
            : 'rgba(200, 200, 200, 0.3)'
    );
    
    monthlyChart.data.datasets[0].backgroundColor = backgroundColors;
    
    // If months are selected, adjust y-axis to fit selected data
    if (selectedMonths.length > 0) {
        const selectedCounts = counts.filter((_, i) => selectedMonths.includes(months[i]));
        const maxCount = Math.max(...selectedCounts);
        monthlyChart.options.scales.y.max = Math.ceil(maxCount * 1.1); // Add 10% padding
    } else {
        // Reset to auto scaling
        monthlyChart.options.scales.y.max = undefined;
    }
    
    monthlyChart.update();
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
