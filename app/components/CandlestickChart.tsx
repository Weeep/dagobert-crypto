import React, { useRef, useEffect } from "react";
//import * as d3 from 'd3';
import * as d3 from "d3";

interface CandlestickChartProps {
  data: any[][];
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr(
        "viewBox",
        `0 0 ${width + margin.left + margin.right} ${
          height + margin.top + margin.bottom
        }`
      )
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand()
      .domain(data.map((d) => d[0].toString()))
      .range([0, width])
      .padding(0.2);

    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(data, (d) => parseFloat(d[3]))!,
        d3.max(data, (d) => parseFloat(d[2]))!,
      ])
      .range([height, 0]);

    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((d) => d3.timeFormat("%H:%M")(new Date(+d)));
    const yAxis = d3.axisLeft(yScale);

    svg.append("g").attr("transform", `translate(0, ${height})`).call(xAxis);

    svg.append("g").call(yAxis);

    svg
      .selectAll(".candlestick")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "candlestick")
      .attr("x", (d) => xScale(d[0].toString())!)
      .attr("y", (d) => yScale(Math.max(parseFloat(d[1]), parseFloat(d[4]))))
      .attr("width", xScale.bandwidth())
      .attr("height", (d) =>
        Math.abs(yScale(parseFloat(d[1])) - yScale(parseFloat(d[4])))
      )
      .attr("fill", (d) =>
        parseFloat(d[4]) > parseFloat(d[1]) ? "green" : "red"
      );

    svg
      .selectAll(".wick")
      .data(data)
      .enter()
      .append("line")
      .attr("class", "wick")
      .attr("x1", (d) => xScale(d[0].toString())! + xScale.bandwidth() / 2)
      .attr("x2", (d) => xScale(d[0].toString())! + xScale.bandwidth() / 2)
      .attr("y1", (d) => yScale(parseFloat(d[2])))
      .attr("y2", (d) => yScale(parseFloat(d[3])))
      .attr("stroke", "black");
  }, [data]);

  return <svg ref={svgRef}></svg>;
};

export default CandlestickChart;
