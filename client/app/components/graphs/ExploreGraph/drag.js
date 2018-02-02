import {
    event as currentEvent,
    selectAll as d3SelectAll,
    select as d3Select,
    mouse as currentMouse,
} from 'd3-selection'

import { NODE_RADIUS } from '../constants'

export const createOuterDrag = (simulation) => (actions) => {
    return {
        dragstart: function() {
            const mouseXy = currentMouse(this.container.node())
            this.graph.dragLine
                .classed("hidden", false)
                .attr("d", `M ${d.x} ${d.y} L ${mouseXy[0]} ${mouseXy[1]}`);

        },
        drag: function() {
            const mouseXy = currentMouse(this.container.node())
            this.graph.dragLine
                .attr("d", `M ${d.x} ${d.y} L ${mouseXy[0]} ${mouseXy[1]}`);

            const nodeSelection = d3SelectAll('.node')
            const prevHoveredNodes = d3SelectAll('.node-hovered')

            // back to their default color again
            prevHoveredNodes.select('circle')
            prevHoveredNodes.classed('node-hovered', false)

            nodeSelection.each(node => {
                if (node === d) return

                const distanceToNode = Math.sqrt((node.x - mouseXy[0])**2 + (node.y - mouseXy[1])**2)

                if (distanceToNode < node.radius) {
                    // change background color
                    d3Select(`#node-${node.id}`)
                        .classed('node-hovered', true)
                        .select('circle')
                }
            })

        },
        dragend: function() {
            const mouseXy = currentMouse(this.container.node())
            const nodeSelection = d3SelectAll('.node')
            const { nodes } = this.props

            this.graph.dragLine.classed("hidden", true)

            const prevHoveredNodes = d3SelectAll('.node-hovered')
            // back to their default color again
            prevHoveredNodes.select('circle')
            prevHoveredNodes.classed('node-hovered', false)

            nodeSelection.each(node => {
                if (node.id === d.id) return

                const distanceToNode = Math.sqrt((node.x - mouseXy[0])**2 + (node.y - mouseXy[1])**2)

                if (distanceToNode < node.radius) {
                    // create an edge from this node to otherNode
                    return actions.connect(d.id, node.id)
                }
            })
        }
    }
}

export const createInnerDrag = (self) => (actions) => {
    let startX = null
    let startY = null;

    let dragStarted = false;
    let nodes = null;

    return {
        dragstart: function() {
            /*
             * Freeze the graph
             */
            const id = d3Select(this).attr('id')

            if (id === self.props.focusNodeId) {
                return;
            }

            dragStarted = true;

            startX = currentEvent.x
            startY = currentEvent.y
            // nodes = self.tree.nodes(d)
        },
        drag: function(d) {
            if (!dragStarted) {
                return;
            }

            const node = d3Select(this)
            const id = node.attr('id')

            // node.attr('transform', `translate(${currentEvent.x}, ${currentEvent.y})`)

            self.setState({ 
                draggedElement: {
                    id: id.replace("node-", ""),
                    x: currentEvent.y, // TODO: why is this switched? - 2018-02-02
                    y: currentEvent.x
                },
                rerender: false
            })

            // // TODO: panning (move with screen when dragging to edges - 2018-02-02
            
            // const nodeSelection = d3SelectAll('.node')
            // const prevHoveredNodes = d3SelectAll('.node-hovered')

            // // back to their default color again
            // prevHoveredNodes.select('circle')
            // prevHoveredNodes.classed('node-hovered', false)

            // nodeSelection.each(node => {
            //     if (node === d) return

            //     const distanceToNode = Math.sqrt((node.x - d.x)**2 + (node.y - d.y)**2)

            //     if (distanceToNode < node.radius) {
            //         // change background color
            //         d3Select(`#node-${node.id}`)
            //             .classed('node-hovered', true)
            //             .select('circle')
            //     }
            // })
        },
        dragend: function() {
            /*
             * Create an edge to all nodes which are being hovered over
             */

            const nodeElement = d3Select(this)
            const id = nodeElement.attr('id').replace("node-", "")
            const node = self.nodesById[id]

            self.setState({ 
                draggedElement: {
                    id: id,
                    x: startY, // TODO: why is this switched? - 2018-02-02
                    y: startX
                },
                rerender: false
            })

            const nodeSelection = d3SelectAll('.node-inside')

            nodeSelection.each(function() {
                // undo fixed state as set in dragstart

                const currentNodeElement = d3Select(this)
                const currentId = currentNodeElement.attr('id').replace("node-", "")
                const currentNode = self.nodesById[currentId]

                if (id === currentId) {
                    return;
                }

                // TODO: x and y are switched here for currentNode - 2018-02-02
                const distanceToNode = Math.sqrt((currentNode.y - currentEvent.x)**2 + (currentNode.x - currentEvent.y)**2)

                if (distanceToNode < NODE_RADIUS) {
                    console.log(distanceToNode)
                    console.log("MOVING TO ABSTRACTION!!!")
                    // move this node to the abstraction that is hovered over
                    // TODO: need a method for getting the currently visible abstraction chain
                    return actions.moveToAbstraction(
                        self.props.focusNode.id,
                        node.id,
                        currentNode.data.id, //TODO: here it is data and before not, do something about this...
                    )
                }
            })
        }
    }
}
