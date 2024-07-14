document.addEventListener('DOMContentLoaded', (event) => {
    addEventListeners();

    // Use the sanitized filename in the fetch request, with the 'graphs' subdirectory
    const jsonFilename = "graphs/" + getJsonFilenameFromUrl();
    fetch(jsonFilename)
        .then(response => response.json())
        .then(data => {
            createAbstractionCheckboxes(data); // Create checkboxes
            globalNodeSelection = createChart(data); // Store the initial node selection
        })
        .catch(error => console.error('Error loading data:', error));
});

// Configuration and constants
const CONFIG = {
    minLinkDistance: 100,
    repulsionStrength: -400,
    alphaDecay: 0.01,
    velocityDecay: 0.2,
    svgWidth: window.innerWidth * 0.95,
    svgHeight: window.innerHeight * 0.90,
    viewBoxX: -window.innerWidth * 0.475,
    viewBoxY: -window.innerHeight * 0.45
};

function addEventListeners() {
    // Use event delegation for better performance
    document.addEventListener('click', (event) => {
        if (event.target.matches('#toggleArrowsButton')) {
            toggleArrows();
        } else if (event.target.matches('#searchButton')) {
            searchNode();
        } else if (event.target.matches('#clearHighlightsButton')) {
            clearHighlights();
        } else if (event.target.closest('#drawerToggle')) {
            toggleDrawer();
        }
    });

    document.getElementById('searchBox').addEventListener('keyup', searchNodeOnEnter);
}

function toggleDrawer() {
    const drawer = document.getElementById('checkboxDrawer');
    const toggleButton = document.getElementById('drawerToggle');
    drawer.classList.toggle('drawer-open');
    toggleButton.classList.toggle('drawer-open');
}

let showArrows = false;
let link, node, labels, simulation; // Declare variables globally
let globalNodeSelection;
let zoom; // Declare zoom globally so it can be used in multiple functions

function createChart(data) {
    const { svgWidth, svgHeight, viewBoxX, viewBoxY } = CONFIG;

    const links = data.links.map(d => ({ ...d }));
    const nodes = data.nodes.map(d => ({ ...d }));

    const svg = createSVG(svgWidth, svgHeight, viewBoxX, viewBoxY);
    const g = svg.append("g");

    setupSimulation(nodes, links);
    setupMarkers(svg);
    setupZoom(svg, g);

    link = createLinks(g, links);
    node = createNodes(g, nodes); // Initialize node
    labels = createLabels(g, nodes); // Initialize labels

    document.querySelector('.graph-container').appendChild(svg.node());
    return node;
}

function createSVG(width, height, viewBoxX, viewBoxY) {
    return d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [viewBoxX, viewBoxY, width, height])
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", "max-width: 100%; height: auto; display: block; margin: auto;");
}

function setupSimulation(nodes, links) {
    const { minLinkDistance, repulsionStrength, alphaDecay, velocityDecay } = CONFIG;

    simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(minLinkDistance))
        .force("charge", d3.forceManyBody().strength(repulsionStrength))
        .force("center", d3.forceCenter(0, 0))
        .force("x", d3.forceX()) 
        .force("y", d3.forceY())
        .alphaDecay(alphaDecay)
        .velocityDecay(velocityDecay)
        .on("tick", ticked);

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => getLinkX2(d))
            .attr("y2", d => getLinkY2(d));

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labels
            .attr("x", d => d.x)
            .attr("y", d => d.y + d.size + 8);
    }

    function getLinkX2(d) {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        const r = d.target.size;
        return d.target.x - (r * dx / dr);
    }

    function getLinkY2(d) {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        const r = d.target.size;
        return d.target.y - (r * dy / dr);
    }
}

function setupMarkers(svg) {
    svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 13)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5")
        .attr("fill", "#999")
        .style("stroke", "none");
}

function setupZoom(svg, g) {
    zoom = d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

    svg.call(zoom);
}

function createLinks(g, links) {
    return g.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => 1)
        .attr("marker-end", showArrows ? "url(#arrowhead)" : "");
}

function createNodes(g, nodes) {
    return g.append("g")
        .attr("stroke", "#000000")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => d.size)
        .attr("fill", d => d.color)
        .on("mouseover", showTooltip)
        .on("mouseout", hideTooltip)
        .on("dblclick", function (event, d) {
            event.stopPropagation();
            openNodeUrl(event, d);
        })
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
}

function createLabels(g, nodes) {
    return g.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("class", "node-label-medium")
        .style("font-size", d => {
            switch (d.label_class) {
                case "node-label-big": return "15px";
                case "node-label-medium": return "10px";
                case "node-label-small": return "7px";
                default: return "";
            }
        })
        .text(d => d.label);
}

function showTooltip(event, d) {
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip");

    tooltip.html(d.Description)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function hideTooltip() {
    d3.select(".tooltip").remove();
}

function openNodeUrl(event, d) {
    if (d.url) {
        window.open(d.url, '_blank');
    }
}

function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
}

// Define toggleArrows globally
function toggleArrows() {
    showArrows = !showArrows;
    link.attr("marker-end", showArrows ? "url(#arrowhead)" : "");
}

function sanitizeInput(input) {
    // Implement sanitization logic
    const sanitizedInput = input.replace(/[^a-z0-9-_.]/gi, '');
    return sanitizedInput;
}

function updatePageTitle() {
    const jsonFileName = getJsonFilenameFromUrl();
    if (jsonFileName) {
        document.title = jsonFileName + " - Graph Visualizer";
    }
}

function getJsonFilenameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let jsonFileName = params.get('jsonfile');
    if (jsonFileName) {
        return sanitizeInput(jsonFileName);
    }
    return 'default.json'; // Default filename if no parameter is provided or after sanitization
}

function searchNode() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    globalNodeSelection.each(function (d) {
        if (d.label.toLowerCase().includes(searchTerm)) {
            d3.select(this).classed("highlighted", true);

            const resultDiv = document.createElement('div');
            resultDiv.classList.add('search-result');
            resultDiv.textContent = d.label;
            resultDiv.onclick = function () {
                highlightNode(d);
                zoomToNode(d);
            };
            resultsContainer.appendChild(resultDiv);
        } else {
            d3.select(this).classed("highlighted", false);
        }
    });
}

function highlightNode(node) {
    globalNodeSelection.classed("highlighted", function (d) {
        return d.id === node.id;
    });
}

function resetHighlights() {
    globalNodeSelection.classed("highlighted", false); // Reset all highlights
}

function searchNodeOnEnter(event) {
    // Check if the Enter key was pressed
    if (event.key === "Enter") {
        searchNode();
    } else {
        // Perform a real-time search to update the results dropdown
        searchNode();
    }
}

function zoomToNode(node) {
    const svg = d3.select("svg");
    const transform = d3.zoomTransform(svg.node());
    const x = -node.x * transform.k;
    const y = -node.y * transform.k;

    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(x, y).scale(transform.k)
    );
}

function clearHighlights() {
    globalNodeSelection.classed("highlighted", false);
    document.getElementById('searchResults').innerHTML = ''; // Clear search results
}

// Function to update the graph based on checkbox states
function updateGraph(originalData) {
    const checkboxes = document.querySelectorAll('.checkbox-container input[type="checkbox"]');
    const checkedCheckboxes = Array.from(checkboxes).filter(checkbox => checkbox.checked);

    let filteredNodes = originalData.nodes.filter(node => {
        return checkedCheckboxes.some(checkbox => checkbox.id === 'checkbox-' + node.type + '-' + node.abstraction);
    });

    let filteredNodeIds = new Set(filteredNodes.map(node => node.id));

    let filteredLinks = originalData.links.filter(link => {
        return filteredNodeIds.has(link.source.id || link.source) && filteredNodeIds.has(link.target.id || link.target);
    });

    // Prepare the new data for the graph
    let filteredData = {
        nodes: filteredNodes,
        links: filteredLinks
    };

    // Clear the existing graph and redraw with the filtered data
    document.querySelector('.graph-container').innerHTML = '';
    globalNodeSelection = createChart(filteredData); // Update globalNodeSelection
}

function createAbstractionCheckboxes(data) {
    let typeAbstractionMap = new Map();

    // Group abstractions by type
    data.nodes.forEach(node => {
        if (!typeAbstractionMap.has(node.type)) {
            typeAbstractionMap.set(node.type, new Set());
        }
        typeAbstractionMap.get(node.type).add(node.abstraction);
    });

    let checkboxDiv = document.querySelector('.checkbox-container');

    // Clear existing content
    checkboxDiv.innerHTML = '';

    // Create checkboxes for each type and its abstractions using Bootstrap styles
    typeAbstractionMap.forEach((abstractions, type) => {
        let typeContainer = document.createElement('div');
        typeContainer.classList.add('mb-3'); // Bootstrap margin-bottom class

        let typeHeader = document.createElement('h3');
        typeHeader.textContent = type;
        typeContainer.appendChild(typeHeader);

        abstractions.forEach(abstraction => {
            // Bootstrap form-check div
            let formCheckDiv = document.createElement('div');
            formCheckDiv.classList.add('form-check');

            // Bootstrap styled checkbox
            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('form-check-input');
            checkbox.id = 'checkbox-' + type + '-' + abstraction;
            checkbox.checked = true;
            checkbox.addEventListener('change', () => updateGraph(data));

            // Label for checkbox
            let label = document.createElement('label');
            label.classList.add('form-check-label');
            label.htmlFor = 'checkbox-' + type + '-' + abstraction;
            label.textContent = abstraction;

            formCheckDiv.appendChild(checkbox);
            formCheckDiv.appendChild(label);
            typeContainer.appendChild(formCheckDiv);
        });

        checkboxDiv.appendChild(typeContainer);
    });
}
