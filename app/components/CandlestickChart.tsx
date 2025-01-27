import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

interface CandlestickChartProps {
  data: {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteVolume: string;
    trades: number;
    baseAssetVolume: string;
    quoteAssetVolume: string;
  }[];
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 70, left: 70 };
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
      .domain(data.map((d) => d.openTime.toString()))
      .range([0, width])
      .padding(0.2);

    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(data, (d) => parseFloat(d.low))!,
        d3.max(data, (d) => parseFloat(d.high))!,
      ])
      .range([height, 0]);

    const xAxis = d3.axisBottom(xScale).tickFormat((d) => {
      const date = new Date(+d);
      return d3.timeFormat("%Y-%m-%d %H:%M")(date);
    });

    const yAxis = d3.axisLeft(yScale);

    svg
      .append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-90)");

    svg.append("g").call(yAxis);

    svg
      .selectAll(".candlestick")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "candlestick")
      .attr("x", (d) => xScale(d.openTime.toString())!)
      .attr("y", (d) =>
        yScale(Math.max(parseFloat(d.open), parseFloat(d.close)))
      )
      .attr("width", xScale.bandwidth())
      .attr("height", (d) =>
        Math.abs(yScale(parseFloat(d.open)) - yScale(parseFloat(d.close)))
      )
      .attr("fill", (d) =>
        parseFloat(d.close) > parseFloat(d.open) ? "green" : "red"
      );

    svg
      .selectAll(".wick")
      .data(data)
      .enter()
      .append("line")
      .attr("class", "wick")
      .attr(
        "x1",
        (d) => xScale(d.openTime.toString())! + xScale.bandwidth() / 2
      )
      .attr(
        "x2",
        (d) => xScale(d.openTime.toString())! + xScale.bandwidth() / 2
      )
      .attr("y1", (d) => yScale(parseFloat(d.high)))
      .attr("y2", (d) => yScale(parseFloat(d.low)))
      .attr("stroke", (d) =>
        parseFloat(d.close) > parseFloat(d.open) ? "green" : "red"
      );

    svg
      .selectAll(".candle-text")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "candle-text")
      .attr("x", (d) => xScale(d.openTime.toString())! + xScale.bandwidth() / 2)
      .attr("y", (d) => yScale(parseFloat(d.high)) - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "8px")
      .text((d) => {
        const totalDiff =
          ((parseFloat(d.high) - parseFloat(d.low)) / parseFloat(d.low)) * 100;
        return totalDiff.toFixed(2) + "%";
      });

    svg
      .selectAll(".body-text")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "body-text")
      .attr("x", (d) => xScale(d.openTime.toString())! + xScale.bandwidth() / 2)
      .attr("y", (d) => yScale(parseFloat(d.high)) - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "8px")
      .text((d) => {
        const bodyDiff =
          (Math.abs(parseFloat(d.open) - parseFloat(d.close)) /
            Math.min(parseFloat(d.open), parseFloat(d.close))) *
          100;
        return bodyDiff.toFixed(2) + "%";
      });
  }, [data]);

  return <svg ref={svgRef}></svg>;
};

export default CandlestickChart;
