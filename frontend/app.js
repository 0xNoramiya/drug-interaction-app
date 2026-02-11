const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

let selectedDrugs = new Set();

const drugInput = document.getElementById('drug-input');
const addBtn = document.getElementById('add-btn');
const specificList = document.getElementById('suggestions');
const tagsContainer = document.getElementById('drug-tags');
const checkBtn = document.getElementById('check-btn');
const clearBtn = document.getElementById('clear-btn');
const resultsSection = document.getElementById('results-section');
const interactionList = document.getElementById('interaction-list');

drugInput.addEventListener('input', handleInput);
addBtn.addEventListener('click', addDrugFromInput);
checkBtn.addEventListener('click', checkInteractions);
clearBtn.addEventListener('click', clearAll);

async function handleInput(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
        specificList.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/drugs?q=${encodeURIComponent(query)}`);
        const drugs = await res.json();
        showSuggestions(drugs);
    } catch (err) {
        console.error('Search failed:', err);
    }
}

function showSuggestions(drugs) {
    specificList.innerHTML = '';
    if (drugs.length === 0) {
        specificList.classList.add('hidden');
        return;
    }

    drugs.forEach(drug => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = drug.name;
        div.onclick = () => {
            addDrug(drug.name);
            drugInput.value = '';
            specificList.classList.add('hidden');
        };
        specificList.appendChild(div);
    });
    specificList.classList.remove('hidden');
}

function addDrugFromInput() {
    const name = drugInput.value.trim();
    if (name) {
        addDrug(name);
        drugInput.value = '';
    }
}

function addDrug(name) {
    if (selectedDrugs.has(name)) return;
    selectedDrugs.add(name);
    renderTags();
}

function removeDrug(name) {
    selectedDrugs.delete(name);
    renderTags();
}

function clearAll() {
    selectedDrugs.clear();
    renderTags();
    resultsSection.classList.add('hidden');
}

function renderTags() {
    tagsContainer.innerHTML = '';
    selectedDrugs.forEach(name => {
        const tag = document.createElement('div');
        tag.className = 'drug-tag';
        tag.innerHTML = `
            ${name}
            <span class="remove-tag" onclick="removeDrug('${name}')">&times;</span>
        `;
        tagsContainer.appendChild(tag);
    });
}

async function checkInteractions() {
    if (selectedDrugs.size < 2) {
        alert('Please select at least 2 drugs to check interactions.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drugs: Array.from(selectedDrugs) })
        });
        const data = await res.json();
        const results = data.interactions;

        resultsSection.classList.remove('hidden');
        interactionList.innerHTML = results.length === 0
            ? '<p>No interactions found.</p>'
            : results.map(i => `
                <div class="interaction-item">
                    <div class="interaction-pair">${i.drug_a} + ${i.drug_b}</div>
                    <div>${i.description}</div>
                </div>
            `).join('');

    } catch (err) {
        console.error('Check failed:', err);
        alert('Failed to check interactions.');
    }
}
