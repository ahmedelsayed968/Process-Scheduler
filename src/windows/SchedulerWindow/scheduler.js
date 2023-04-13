const Schedular = require('../../util/Scheduler');
const {InputProcess} = require('../../util/Process');
const { ipcRenderer } = require('electron');
const { Console } = require('console');


// Globals
let ALGORITHM_STARTED = false;
let PROCESS_ID = 1;
let arrivalTimeIntervalID = null;
const WIDTH_UNIT = 30;
const algorithmTitle = document.querySelector('.header h1').innerText.toLowerCase();
const addProcessForm = document.querySelector('#new-process-form');
const startBtn = document.getElementById('start-btn');
const liveInput = document.getElementById('live');
const chartContainer = document.getElementById('chart-container');
const arrivalTimeInput = document.getElementById('arrival-time');
const avgWaitingTimeElement = document.getElementById('avg-waiting-result');
const avgTurnaroundTimeElement = document.getElementById('avg-turnaround-result');
let table = null;
const schedular = new Schedular([]);
const colors = ['#002B5B', '#EA5455'];
let curColor = colors[0];
function toggleColor(){
    curColor === colors[0] ? curColor = colors[1] : curColor = colors[0];
}


// Handle back button
document.getElementById('back-btn').addEventListener('click', () => {
    ipcRenderer.send('gotoMainWindow');
});
// Handle Retry button
document.getElementById('retry-btn').addEventListener('click', () => {
    window.location.reload();
});


// Table configuration
function configureProcessesTable(){
    const tableColumns = [
		{ title: 'Process ID', field: 'processId', resizable: false },
		{ title: 'Arrival Time', field: 'arrivalTime', resizable: false },
		{ title: 'Burst Time', field: 'burstTime', resizable: false },
	];
	if (algorithmTitle.includes('priority')) {
		tableColumns.push({ title: 'Priority', field: 'priority', resizable: false });
	}
	table = new Tabulator('#processes-table', {
		columns: tableColumns,
		data: [],
		layout: 'fitColumns',
		movableRows: true,
		height: '100%',
		rowHeight: 30,
	});

    addProcessForm.addEventListener('submit', (submitEvent) => {
		submitEvent.preventDefault();
		addNewProcess();
        evacuateInputFields();
	});
}


// Chart configuration 
function configureChart() {
	let curProcess = null;
	let curProcessDiv = null;
	startBtn.addEventListener('click', async () => {
		startArrivalTimeTimer();
		ALGORITHM_STARTED = true;
		// get the data from the table then add all processes to scheduler queue
		table
			.getData()
			.map((process) =>
					new InputProcess(
						process.processId,
						process.arrivalTime,
						process.burstTime,
						process.priority
					)
			)
			.forEach((process) => {
				schedular.appendToQueue(process);
			});
		// run the algorithm
		runSelectedScheduler(liveInput.checked);
		disableStartBtn();
	});
	schedular.on('draw', (receivedProcess /* GUIProcess */) => {
		if (receivedProcess?.processId === curProcess?.processId) {
			// same as the running process
			curProcessDiv.style.width = `${curProcessDiv.offsetWidth + WIDTH_UNIT}px`;
			for (let child of curProcessDiv.children) {
				if (child.classList.contains('chart-segment-end-time')) {
					child.innerText = receivedProcess.end;
				}
			}
		} else {
			// new process
			curProcess = receivedProcess;
			curProcessDiv = createChartSegment(curProcess);
			if (liveInput.checked) {
				curProcessDiv.classList.add('live-chart-segment');
			}
			chartContainer.appendChild(curProcessDiv);
		}
	});
	schedular.on('drawAll', (processes) => {
		processes.forEach((process) => {
			schedular.emit('draw', process);
		});
	});
}


// Time configuration
function configureTime() {
	schedular.on('done', (avgTime) => {
		avgWaitingTimeElement.innerText = `${avgTime.waiting.toFixed(2)}s`;
		avgTurnaroundTimeElement.innerText = `${avgTime.turnaround.toFixed(2)}s`;
		terminateAlgorithm();
	});
}


// Helpers
function addNewProcess(){
    const arrivalTime = Number(document.getElementById('arrival-time')?.value);
    const burstTime = Number(document.getElementById('burst-time')?.value);
    const priority = Number(document.getElementById('priority')?.value);
    const newRow = {
        processId: PROCESS_ID,
        arrivalTime,
        burstTime,
    };
    if (algorithmTitle.includes('priority')) {
        newRow.priority = priority;
    }
    table.addRow(newRow);
    if (ALGORITHM_STARTED) {
        schedular.appendToQueue(new InputProcess(PROCESS_ID, arrivalTime, burstTime, priority));
    }
    PROCESS_ID++;
}
function evacuateInputFields(){
    if(!ALGORITHM_STARTED){
        document.getElementById('arrival-time').value = '';
    }
    document.getElementById('burst-time').value = '';
	if(algorithmTitle.includes('priority')){
		// this element does not exist except for priority algorithms
		document.getElementById('priority').value = '';
	}
}
function startArrivalTimeTimer(){
    let timer = 0;
    arrivalTimeInput.disabled = true;
    arrivalTimeIntervalID = setInterval(() => {
        arrivalTimeInput.value = timer;
        timer++;
    }, 1000);
}
function disableStartBtn(){
    startBtn.disabled = true;
    startBtn.classList.add('disabled-btn');
}
function createChartSegment(process /* InputProcess */) {
    chartDiv = document.createElement('div');
    chartDiv.classList.add('chart-segment');
    chartDiv.style.backgroundColor = curColor;
    toggleColor();
    chartDiv.innerHTML = `
        <p class="chart-segment-start-time">${process.start}</p>
        <p class="chart-segment-end-time">${process.end}</p>
        P${process.processId}
    `
    return chartDiv;
}
function runSelectedScheduler(live /* Boolean */){
	if(algorithmTitle === 'non-preemptive priority'){
		schedular.nonPreemptivePriority(live);
	} else if(algorithmTitle === 'preemptive priority'){
		// to be connected
	} else if(algorithmTitle === 'preemptive shortest job first (sjf)'){
		schedular.PreemptiveSJF(live);
	} else if (algorithmTitle === 'non-preemptive shortest job first (sjf)') {
		schedular.sjfNonPreemptive(live)
	} else if(algorithmTitle === 'round robin'){
		// to be connected
	} else if(algorithmTitle === 'first come first serve (fcfs)'){
		// to be connected
	}
}
function terminateAlgorithm(){
	clearInterval(arrivalTimeIntervalID);
	for(let child of addProcessForm.children){
		console.log(`disabling ${child.tagName}}`)
		child.disabled = true;
		if(child.tagName.toLowerCase() === 'input'){
			child.value = '';
		} else {
			child.classList.add('disabled-btn');
		}
	}
}

// Main
configureProcessesTable();
configureChart();
configureTime();