const fractionKeys = ['dissolved', 'adsorbed', 'immobilized'];

const weekMarker = {
  id: 'weekMarker',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || chart.selectedWeek === undefined) return;

    const x = scales.x.getPixelForValue(chart.selectedWeek);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.strokeStyle = chart.options.backgroundColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = chart.options.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
};

export function createCharts(duration) {
  if (!window.Chart) return null;

  const weeks = Array.from({ length: duration + 1 }, (_, week) => week);
  const options = (stacked) => ({
    animation: false,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        stacked,
        grid: { display: false },
        ticks: { autoSkip: true, maxTicksLimit: 5, maxRotation: 0 },
        title: { display: true },
      },
      y: {
        stacked,
        beginAtZero: true,
        max: stacked ? 100 : undefined,
        ticks: { maxTicksLimit: 5 },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, boxHeight: 5, padding: 9, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          title: ([item]) => item ? item.chart.options.scales.x.title.text + ' ' + item.label : '',
          label: (item) => {
            const chart = item.chart;
            const formatter = new Intl.NumberFormat(chart.options.locale, { maximumFractionDigits: 2 });
            const unit = stacked ? '%' : 'mg/kg';
            return item.dataset.label + ' · ' + formatter.format(item.parsed.y) + ' ' + unit;
          },
        },
      },
    },
  });

  const concentration = new window.Chart(document.getElementById('concChart'), {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [
        { data: [], borderWidth: 2, pointRadius: 2 },
        { data: [], borderWidth: 2, pointRadius: 2, borderDash: [4, 3] },
      ],
    },
    options: options(false),
    plugins: [weekMarker],
  });
  const fractions = new window.Chart(document.getElementById('fractionChart'), {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: fractionKeys.map(() => ({ data: [], stack: 'fractions' })),
    },
    options: options(true),
    plugins: [weekMarker],
  });

  function applyPalette() {
    const text = getComputedStyle(document.getElementById('concCaption')).color;
    const panel = getComputedStyle(document.querySelector('.results'));
    const grid = getComputedStyle(document.querySelector('.workspace')).borderTopColor;
    const [dissolved, adsorbed, immobilized] = fractionKeys.map((key) =>
      getComputedStyle(document.querySelector('.fraction-' + key)).backgroundColor);

    for (const chart of [concentration, fractions]) {
      chart.options.color = text;
      chart.options.backgroundColor = panel.backgroundColor;
      chart.options.scales.x.ticks.color = text;
      chart.options.scales.x.title.color = text;
      chart.options.scales.y.ticks.color = text;
      chart.options.scales.y.grid.color = grid;
    }
    [adsorbed, immobilized].forEach((color, index) => {
      const dataset = concentration.data.datasets[index];
      dataset.borderColor = color;
      dataset.backgroundColor = color;
    });
    [dissolved, adsorbed, immobilized].forEach((color, index) => {
      fractions.data.datasets[index].backgroundColor = color;
    });
    concentration.update();
    fractions.update();
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPalette);
  applyPalette();

  return { concentration, fractions };
}

export function updateCharts(charts, history, labels, language) {
  if (!charts) return;

  const { concentration, fractions } = charts;
  const records = history.map(({ state }) => state);
  concentration.data.datasets[0].label = labels.surface;
  concentration.data.datasets[0].data = records.map((state) => state.surfaceConc);
  concentration.data.datasets[1].label = labels.deep;
  concentration.data.datasets[1].data = records.map((state) => state.deepConc);
  fractionKeys.forEach((key, index) => {
    fractions.data.datasets[index].label = labels[key];
    fractions.data.datasets[index].data = records.map((state) => state.fractions[key] * 100);
  });

  for (const chart of [concentration, fractions]) {
    chart.options.locale = language;
    chart.options.scales.x.title.text = labels.week;
    chart.update();
  }
}

export function markChartWeek(charts, week) {
  if (!charts) return;

  for (const chart of Object.values(charts)) {
    chart.selectedWeek = week;
    chart.draw();
  }
}
