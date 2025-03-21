// Global variables
let dashboardData = null;
let currentPage = 1;
let pageSize = 10;
let phaseChart = null;
let annualChart = null;
let currentPhase = 1;
let currentPhaseDataType = 'count';
let currentAnnualDataType = 'protests';
let filteredTableData = [];
let searchTerm = '';
let locationSearchTerm = '';
let annualData = {};
let locationFilteredData = [];
let phaseTotals = {
    protests: {},
    protesters: {},
    arrests: {}
};

// Fetch and load the data
async function loadData() {
    try {
        const response = await fetch('static/data.json');
        if (!response.ok) {
            throw new Error('Failed to load data');
        }
        
        try {
            const text = await response.text();
            try {
                dashboardData = JSON.parse(text);
            } catch (jsonError) {
                console.error('JSON parse error:', jsonError);
                console.error('First 500 characters of response:', text.substring(0, 500));
                throw new Error('Failed to parse data file. The JSON may be malformed.');
            }
        } catch (parseError) {
            console.error('Text parsing error:', parseError);
            throw new Error('Failed to read data file content.');
        }
        
        // Initialize filtered data
        filteredTableData = dashboardData.table_data;
        
        // Log data structure for debugging
        console.log('Data loaded:', dashboardData);
        console.log('Total arrests from data:', dashboardData.total_arrests);
        console.log('Data type of total_arrests:', typeof dashboardData.total_arrests);
        console.log('Phase 1 sample:', dashboardData.phase1_monthly[0]);
        console.log('Phase 2 sample:', dashboardData.phase2_monthly[0]);
        console.log('Phase 3 sample:', dashboardData.phase3_monthly[0]);
        console.log('Phase 4 sample:', dashboardData.phase4_monthly[0]);
        console.log('Phase 5 sample:', dashboardData.phase5_monthly[0]);
        
        // Calculate phase totals before initializing the dashboard
        calculatePhaseTotals();
        
        // Process annual data
        processAnnualData();
        
        // Initialize the dashboard
        updateSummaryStats();
        initializePhaseChart();
        initializeAnnualChart();
        updateTable();
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.body.innerHTML = `<div class="alert alert-danger">
            Failed to load data: ${error.message}. Make sure you've run the Python script to generate the data file.
        </div>`;
    }
}

// Calculate phase totals
function calculatePhaseTotals() {
    // Initialize phase totals
    const phases = ['phase1_monthly', 'phase2_monthly', 'phase3_monthly', 'phase4_monthly', 'phase5_monthly'];
    
    // Calculate cumulative totals for each phase
    let cumulativeProtests = 0;
    let cumulativeProtesters = 0;
    
    // For arrests, we'll use the actual arrest data from each phase
    // Track cumulative arrests for phase totals
    let cumulativeArrests = 0;
    
    phases.forEach((phase, index) => {
        const phaseData = dashboardData[phase];
        let phaseProtests = 0;
        let phaseProtesters = 0;
        
        phaseData.forEach(item => {
            phaseProtests += item.count || 0;
            phaseProtesters += item.size || 0;
        });
        
        cumulativeProtests += phaseProtests;
        cumulativeProtesters += phaseProtesters;
        
        // Calculate phase-specific arrests by summing the actual arrest data
        let phaseArrests = 0;
        phaseData.forEach(item => {
            // Make sure we're parsing the arrests value as a number
            const arrestValue = parseFloat(item.arrests) || 0;
            phaseArrests += arrestValue;
        });
        
        // Add to cumulative arrests
        cumulativeArrests += phaseArrests;
        
        // Round to whole number for display
        const roundedPhaseArrests = Math.round(phaseArrests);
        const roundedCumulativeArrests = Math.round(cumulativeArrests);
        
        console.log(`Phase ${index + 1} arrests: ${roundedPhaseArrests}, cumulative: ${roundedCumulativeArrests}`);
        
        // Log the first few months with arrest data for verification
        const arrestSamples = phaseData
            .filter(item => parseFloat(item.arrests) > 0)
            .slice(0, 3)
            .map(item => `${item.month}: ${item.arrests}`);
        
        if (arrestSamples.length > 0) {
            console.log(`Phase ${index + 1} arrest samples: ${arrestSamples.join(', ')}`);
        }
        
        // Store cumulative totals for each phase
        phaseTotals.protests[index + 1] = cumulativeProtests;
        phaseTotals.protesters[index + 1] = cumulativeProtesters;
        phaseTotals.arrests[index + 1] = Math.round(cumulativeArrests);
    });
    
    console.log('Phase totals calculated:', phaseTotals);
}

// Update summary statistics based on current phase
function updateSummaryStats() {
    // Use the totals for the current phase
    const protestTotal = phaseTotals.protests[currentPhase] || 0;
    const protesterTotal = phaseTotals.protesters[currentPhase] || 0;
    const arrestTotal = phaseTotals.arrests[currentPhase] || 0;
    
    document.getElementById('total-protests').textContent = protestTotal.toLocaleString();
    document.getElementById('total-protesters').textContent = protesterTotal.toLocaleString();
    document.getElementById('total-arrests').textContent = arrestTotal.toLocaleString();
    
    // Log for debugging
    console.log('Updated summary stats:', {
        protests: protestTotal,
        protesters: protesterTotal,
        arrests: arrestTotal,
        rawArrestsValue: dashboardData.total_arrests
    });
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
                    display: false
                }
            }
        }
    });
    
    // Add event listeners for phase navigation and data type
    document.getElementById('next-phase').addEventListener('click', () => {
        if (currentPhase < 5) {
            currentPhase++;
            updatePhaseChart();
            updateSummaryStats(); // Update summary stats when phase changes
        }
    });
    
    document.getElementById('prev-phase').addEventListener('click', () => {
        if (currentPhase > 1) {
            currentPhase--;
            updatePhaseChart();
            updateSummaryStats(); // Update summary stats when phase changes
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
    document.getElementById('next-phase').disabled = (currentPhase === 5);
    
    // Update title and description
    const titleElement = document.getElementById('phase-title');
    const descriptionElement = document.getElementById('phase-description');
    
    let data, labels, chartType, backgroundColors;
    // Select the appropriate data field based on the selected type
    let dataField, dataLabel;
    if (currentPhaseDataType === 'count') {
        dataField = 'count';
        dataLabel = 'Number of Protests';
    } else if (currentPhaseDataType === 'protesters') {
        dataField = 'size';
        dataLabel = 'Total Protesters';
    } else if (currentPhaseDataType === 'arrests') {
        dataField = 'arrests';
        dataLabel = 'Total Arrests';
    }
    
    console.log('Using data field:', dataField);
    
    // Prepare data based on current phase
    if (currentPhase === 1) {
        // Phase 1: Beginning until July 2014
        titleElement.textContent = '2012 to 2014: Building Tension';
        descriptionElement.textContent = `Prior to 2014, while police brutality protests remained relatively localized, the 2012 killing of Trayvon Martin by neighborhood watch volunteer George Zimmerman and his 2013 acquittal sparked nationwide outrage and mobilization, giving rise to the Black Lives Matter hashtag and laying crucial groundwork for the movement against racialized violence that would soon emerge.`;
        
        // Use the data field directly from our processed data
        data = dashboardData.phase1_monthly.map(item => item[dataField] || 0);
        labels = dashboardData.phase1_monthly.map(item => item.month);
        chartType = 'bar';
        backgroundColors = '#1b9e77'; // Green for Phase 1
        
    } else if (currentPhase === 2) {
        // Phase 2: August 2014 until December 2016
        titleElement.textContent = 'The Birth of Modern Movement';
        descriptionElement.textContent = `From 2014 to 2016, the Black Lives Matter movement established a sustained period of nationwide protests, initially sparked by the deaths of Eric Garner and Michael Brown and later reignited following the killings of Alton Sterling and Philando Castile, in response to police brutality and racial injustice.`;
        
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
        titleElement.textContent = 'The Trump Era';
        descriptionElement.textContent = `While the election of President Trump catalyzed a massive increase in protests nationwide, relatively few demonstrations focused specifically on police brutality, marking a temporary shift in the primary focus of public activism before the next wave of racial justice protests.`;
        
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
        
    } else if (currentPhase === 4) {
        // Phase 4: Floyd protest surge (May-Oct 2020)
        titleElement.textContent = 'BLM Summer';
        descriptionElement.textContent = `In 2020, the killing of George Floyd by Minneapolis police officers ignited unprecedented nationwide protests against police brutality and racial injustice, mobilizing millions of Americans across all 50 states in what became the largest mass demonstration movement in U.S. history.`;
        
        // Combine all previous phases with phase 4 data to show the dramatic increase
        const phase1Data = dashboardData.phase1_monthly;
        const phase2Data = dashboardData.phase2_monthly;
        const phase3Data = dashboardData.phase3_monthly;
        const phase4Data = dashboardData.phase4_monthly;
        
        // Create a combined dataset with all months
        const allMonths = [...new Set([
            ...phase1Data.map(item => item.month),
            ...phase2Data.map(item => item.month),
            ...phase3Data.map(item => item.month),
            ...phase4Data.map(item => item.month)
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
        phase4Data.forEach(setCountValue);
        
        labels = allMonths;
        data = allMonths.map(month => countLookup[month] || 0);
        
        // Color-code by period with distinct colors for each phase
        backgroundColors = allMonths.map(month => {
            if (month <= '2014-07') {
                return '#1b9e77'; // Green for Phase 1
            } else if (month > '2014-07' && month <= '2016-12') {
                return '#d95f02'; // Orange for Phase 2
            } else if (month > '2016-12' && month <= '2020-04') {
                return '#7570b3'; // Purple for Phase 3
            } else {
                return '#e7298a'; // Pink for Phase 4 (Floyd period)
            }
        });
        
        chartType = 'bar';
        
    } else if (currentPhase === 5) {
        // Phase 5: All data with color coding by period
        titleElement.textContent = 'Ongoing Advocacy';
        descriptionElement.textContent = `After the initial surge of protests following George Floyd's killing, the volume of demonstrations gradually declined through 2021, yet remained at significantly higher levels than pre-2020 periods.`;
        
        // Combine all phase data to show the complete timeline
        const phaseData = {
            phase1: dashboardData.phase1_monthly,
            phase2: dashboardData.phase2_monthly,
            phase3: dashboardData.phase3_monthly,
            phase4: dashboardData.phase4_monthly,
            phase5: dashboardData.phase5_monthly
        };
        
        // Create a combined dataset with all months
        const allMonths = [...new Set([
            ...phaseData.phase1.map(item => item.month),
            ...phaseData.phase2.map(item => item.month),
            ...phaseData.phase3.map(item => item.month),
            ...phaseData.phase4.map(item => item.month),
            ...phaseData.phase5.map(item => item.month)
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
        phaseData.phase4.forEach(setCountLookup);
        phaseData.phase5.forEach(setCountLookup);
        
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
                return '#e7298a'; // Pink for Phase 4 (Floyd period)
            } else {
                return '#66a61e'; // Green-yellow for Phase 5 (post-Floyd period)
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
                    borderColor: backgroundColors,
                    borderWidth: 0, // Remove the border completely
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
        phaseChart.data.datasets[0].borderColor = backgroundColors; // Update border color to match background
        phaseChart.data.datasets[0].label = dataLabel;
        
        phaseChart.update();
    }
}

// Filter table data based on search term
function filterTableData() {
    if (!searchTerm) {
        filteredTableData = dashboardData.table_data;
        return;
    }
    
    const term = searchTerm.toLowerCase();
    filteredTableData = dashboardData.table_data.filter(protest => {
        return (
            (protest.date && protest.date.toLowerCase().includes(term)) ||
            (protest.locality && protest.locality.toLowerCase().includes(term)) ||
            (protest.state && protest.state.toLowerCase().includes(term)) ||
            (protest.type && protest.type.toLowerCase().includes(term)) ||
            (protest.claims && protest.claims.toLowerCase().includes(term))
        );
    });
}

// Update the data table
function updateTable() {
    const tableBody = document.getElementById('data-table-body');
    const pagination = document.getElementById('pagination');
    
    // Filter data based on search term
    filterTableData();
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredTableData.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredTableData.length);
    
    // Clear the table
    tableBody.innerHTML = '';
    
    if (filteredTableData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="text-center">No matching protests found</td>';
        tableBody.appendChild(row);
    } else {
        // Add data rows
        for (let i = startIndex; i < endIndex; i++) {
            const protest = filteredTableData[i];
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${protest.date}</td>
                <td>${protest.locality}</td>
                <td>${protest.state}</td>
                <td>${protest.type}</td>
                <td>${protest.claims}</td>
                <td>${protest.size_mean === 11 ? '' : protest.size_mean}</td>
                <td>${protest.arrests || ''}</td>
            `;
            
            tableBody.appendChild(row);
        }
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

// Handle search functionality
function setupSearchFunctionality() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearButton = document.getElementById('clear-search');
    
    // Search when button is clicked
    searchButton.addEventListener('click', () => {
        searchTerm = searchInput.value.trim();
        currentPage = 1; // Reset to first page
        updateTable();
    });
    
    // Search when Enter key is pressed
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchTerm = searchInput.value.trim();
            currentPage = 1; // Reset to first page
            updateTable();
        }
    });
    
    // Clear search
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        currentPage = 1; // Reset to first page
        updateTable();
    });
}

// Process annual data from the raw data
function processAnnualData() {
    // Create a structure to hold annual totals
    annualData = {
        years: [],
        protests: {},
        protesters: {},
        arrests: {},
        locationArrests: {} // New object to hold arrests by location and year
    };
    
    // Extract years from the data
    const years = new Set();
    dashboardData.table_data.forEach(protest => {
        if (protest.date) {
            const year = protest.date.substring(0, 4);
            years.add(year);
        }
    });
    
    // Sort years
    annualData.years = Array.from(years).sort();
    
    // Initialize counters for each year
    annualData.years.forEach(year => {
        annualData.protests[year] = 0;
        annualData.protesters[year] = 0;
        annualData.arrests[year] = 0;
        annualData.locationArrests[year] = {}; // Initialize nested object for each year
    });
    
    // Process weekly data to get annual totals
    dashboardData.weekly_counts.forEach(week => {
        if (week.start_date) {
            const year = week.start_date.substring(0, 4);
            if (annualData.years.includes(year)) {
                annualData.protests[year] += week.count || 0;
                annualData.protesters[year] += week.protester_count || 0;
                // Locations are handled separately
            }
        }
    });
    
    
    // Process arrests data from table_data after applying filters
    dashboardData.table_data.forEach(protest => {
        if (protest.date && protest.arrests) {
            // Check if this is one of the events to be zeroed out
            const shouldZero = (
                (protest.date === '2015-04-01' && protest.locality === 'Baltimore' && protest.state === 'MD') ||
                (protest.date === '2020-05-29' && protest.locality === 'Omaha' && protest.state === 'NE') ||
                (protest.date === '2016-07-05' && protest.locality === 'Baton Rouge' && protest.state === 'LA') ||
                (protest.date === '2016-07-07' && protest.locality === 'Baton Rouge' && protest.state === 'LA') ||
                (protest.date === '2016-07-13' && protest.locality === 'Baton Rouge' && protest.state === 'LA') ||
                (protest.date === '2014-11-26' && protest.locality === 'Los Angeles' && protest.state === 'CA') ||
                (protest.date === '2013-06-17' && protest.locality === 'Raleigh' && protest.state === 'NC')
            );

            const arrestValue = shouldZero ? 0 : (protest.arrests || 0);
            const year = protest.date.substring(0, 4);
            
            if (annualData.years.includes(year)) {
                annualData.arrests[year] += arrestValue;
                if (protest.locality && protest.state) {
                    const location = `${protest.locality}, ${protest.state}`;
                    if (!annualData.locationArrests[year][location]) {
                        annualData.locationArrests[year][location] = 0;
                    }
                    annualData.locationArrests[year][location] += arrestValue;
                }
            }
        }
    });
    
    
    console.log('Processed annual data:', annualData);
}

// Initialize the annual totals chart
function initializeAnnualChart() {
    const ctx = document.getElementById('annual-chart').getContext('2d');
    
    // Prepare data for the chart based on selected type
    const labels = annualData.years;
    let data, backgroundColor, label;
    
    // Set initial data based on default type (protests)
    data = labels.map(year => annualData.protests[year]);
    backgroundColor = '#1b9e77';
    label = 'Number of Protests';
    
    // Create the chart with a single dataset
    annualChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: backgroundColor,
                borderColor: backgroundColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: false
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
    
    // Add event listeners for annual data type
    document.querySelectorAll('input[name="annualDataType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentAnnualDataType = this.value;
            updateAnnualChart();
        });
    });
    
    // Set up location search functionality
    setupLocationSearch();
}

// Update the annual chart based on selected data type
function updateAnnualChart() {
    const labels = annualData.years;
    let data, backgroundColor, label;
    
    // Set data based on selected type
    switch(currentAnnualDataType) {
        case 'protests':
            data = labels.map(year => annualData.protests[year]);
            backgroundColor = '#1b9e77';
            label = 'Number of Protests';
            break;
        case 'protesters':
            data = labels.map(year => annualData.protesters[year]);
            backgroundColor = '#d95f02';
            label = 'Number of Protesters';
            break;
        case 'arrests':
            data = labels.map(year => annualData.arrests[year]);
            backgroundColor = '#7570b3';
            label = 'Number of Arrests';
            break;
    }
    
    // Update chart data
    annualChart.data.datasets[0].data = data;
    annualChart.data.datasets[0].label = label;
    annualChart.data.datasets[0].backgroundColor = backgroundColor;
    annualChart.data.datasets[0].borderColor = backgroundColor;
    
    // If we have a location filter active, reapply it
    if (locationSearchTerm && locationFilteredData.length > 0) {
        updateAnnualChartForLocation(locationSearchTerm.toLowerCase());
    }
    
    annualChart.update();
}

// Set up location search functionality with autocomplete
function setupLocationSearch() {
    const searchInput = document.getElementById('location-search');
    const searchButton = document.getElementById('location-search-button');
    const clearButton = document.getElementById('location-clear-button');
    const resultsContainer = document.getElementById('location-results-container');
    const resultsTitle = document.getElementById('location-results-title');
    
    // Create autocomplete dropdown
    const autocompleteContainer = document.createElement('div');
    autocompleteContainer.className = 'autocomplete-items';
    autocompleteContainer.style.cssText = 'position: absolute; border: 1px solid #ddd; border-top: none; z-index: 99; width: 100%; max-height: 200px; overflow-y: auto; background-color: white;';
    searchInput.parentNode.appendChild(autocompleteContainer);
    
    // Get unique locations from the dataset
    const uniqueLocations = getUniqueLocations();
    console.log(`Found ${uniqueLocations.length} unique locations in dataset`);
    
    // Add input event listener for autocomplete
    searchInput.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        
        // Clear previous autocomplete results
        autocompleteContainer.innerHTML = '';
        
        if (!val) {
            autocompleteContainer.style.display = 'none';
            return;
        }
        
        // Filter locations that match the input
        const matchingLocations = uniqueLocations.filter(location => 
            location.toLowerCase().startsWith(val)
        ).slice(0, 10); // Limit to 10 suggestions
        
        if (matchingLocations.length > 0) {
            autocompleteContainer.style.display = 'block';
            
            // Add matching locations to dropdown
            matchingLocations.forEach(location => {
                const item = document.createElement('div');
                item.innerHTML = `<strong>${location.substring(0, val.length)}</strong>${location.substring(val.length)}`;
                item.style.padding = '10px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid #ddd';
                
                // Add hover effect
                item.addEventListener('mouseover', function() {
                    this.style.backgroundColor = '#e9e9e9';
                });
                item.addEventListener('mouseout', function() {
                    this.style.backgroundColor = 'white';
                });
                
                // Set input value when clicked
                item.addEventListener('click', function() {
                    searchInput.value = location;
                    autocompleteContainer.style.display = 'none';
                    // Automatically search when a location is selected
                    locationSearchTerm = location;
                    filterDataByLocation(locationSearchTerm);
                });
                
                autocompleteContainer.appendChild(item);
            });
        } else {
            autocompleteContainer.style.display = 'none';
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== searchInput) {
            autocompleteContainer.style.display = 'none';
        }
    });
    
    // Search when button is clicked
    searchButton.addEventListener('click', () => {
        locationSearchTerm = searchInput.value.trim();
        if (locationSearchTerm) {
            filterDataByLocation(locationSearchTerm);
        }
    });
    
    // Search when Enter key is pressed
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            locationSearchTerm = searchInput.value.trim();
            if (locationSearchTerm) {
                filterDataByLocation(locationSearchTerm);
                autocompleteContainer.style.display = 'none';
            }
        }
    });
    
    // Clear search
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        locationSearchTerm = '';
        resultsContainer.style.display = 'none';
        autocompleteContainer.style.display = 'none';
        updateAnnualChartForAllLocations();
    });
}

// Get unique locations from the dataset
function getUniqueLocations() {
    const locations = new Set();
    
    dashboardData.table_data.forEach(protest => {
        if (protest.locality && protest.state) {
            const location = `${protest.locality}, ${protest.state}`;
            locations.add(location);
        }
    });
    
    return Array.from(locations).sort();
}

// Filter data by location and update the annual chart
function filterDataByLocation(location) {
    const locationLower = location.toLowerCase();
    
    // Filter table data for this location
    locationFilteredData = dashboardData.table_data.filter(protest => {
        if (protest.locality && protest.state) {
            const fullLocation = `${protest.locality}, ${protest.state}`.toLowerCase();
            return fullLocation.includes(locationLower);
        }
        return false;
    });
    
    // If we found matching data, update the chart and show the results
    if (locationFilteredData.length > 0) {
        updateAnnualChartForLocation(locationLower);
        updateLocationResultsTable();
        document.getElementById('location-results-container').style.display = 'block';
        document.getElementById('location-results-title').textContent = `Results for "${location}" (${locationFilteredData.length} protests)`;
    } else {
        alert(`No protests found for location: ${location}`);
    }
}

// Update the annual chart for a specific location
function updateAnnualChartForLocation(location) {
    // Create a structure to hold annual totals for this location
    const locationAnnualData = {
        protests: {},
        protesters: {},
        arrests: {}
    };
    
    // Initialize counters for each year
    annualData.years.forEach(year => {
        locationAnnualData.protests[year] = 0;
        locationAnnualData.protesters[year] = 0;
        locationAnnualData.arrests[year] = 0;
    });
    
    // Process the filtered data
    locationFilteredData.forEach(protest => {
        if (protest.date) {
            const year = protest.date.substring(0, 4);
            if (annualData.years.includes(year)) {
                locationAnnualData.protests[year]++;
                locationAnnualData.protesters[year] += protest.size_mean || 0;
            }
        }
    });
    
    // Get data based on current data type
    let data;
    switch(currentAnnualDataType) {
        case 'protests':
            data = annualData.years.map(year => locationAnnualData.protests[year]);
            break;
        case 'protesters':
            data = annualData.years.map(year => locationAnnualData.protesters[year]);
            break;
        case 'arrests':
            // Get arrest data for the location
            const locationKey = `${locationFilteredData[0]?.locality}, ${locationFilteredData[0]?.state}`;
            data = annualData.years.map(year => {
                if (annualData.locationArrests[year] && annualData.locationArrests[year][locationKey]) {
                    return annualData.locationArrests[year][locationKey];
                }
                return 0;
            });
            break;
    }
    
    // Update the chart with the new data
    annualChart.data.datasets[0].data = data;
    
    annualChart.update();
}

// Update the annual chart to show all locations (reset)
function updateAnnualChartForAllLocations() {
    // Get data based on current data type
    let data;
    switch(currentAnnualDataType) {
        case 'protests':
            data = annualData.years.map(year => annualData.protests[year]);
            break;
        case 'protesters':
            data = annualData.years.map(year => annualData.protesters[year]);
            break;
        case 'arrests':
            data = annualData.years.map(year => annualData.arrests[year]);
            break;
    }
    
    // Update the chart with the new data
    annualChart.data.datasets[0].data = data;
    
    annualChart.update();
}

// Update the location results table
function updateLocationResultsTable() {
    const tableBody = document.getElementById('location-table-body');
    tableBody.innerHTML = '';
    
    if (locationFilteredData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="text-center">No matching protests found</td>';
        tableBody.appendChild(row);
    } else {
        // Add data rows
        locationFilteredData.forEach(protest => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${protest.date}</td>
                <td>${protest.locality}</td>
                <td>${protest.state}</td>
                <td>${protest.type}</td>
                <td>${protest.claims}</td>
                <td>${protest.size_mean === 11 ? '' : protest.size_mean}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadData().then(() => {
        setupSearchFunctionality();
    });
});
