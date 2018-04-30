// based on https://github.com/agentcooper/react-pdf-annotator/blob/master/src/components/PdfAnnotator.js
import React, { Component } from 'react'
import ReactDOM from 'react-dom'

import Popup from './Popup'
import Highlight from './Highlight'
import AreaHighlight from './AreaHighlight'
import PdfAnnotationTooltip from './PdfAnnotationTooltip'
import PdfAreaSelection from './PdfAreaSelection'
import PdfTextSelection from './PdfTextSelection'

import { scaledToViewport, viewportToScaled } from "./lib/coordinates";

// interface
import { PDFJS } from "pdfjs-dist";

// actually requires code for the pdf_viewer https://github.com/mozilla/pdf.js/
require("pdfjs-dist/web/pdf_viewer");
import "pdfjs-dist/web/pdf_viewer.css";
import './styles.scss'


PDFJS.disableWorker = true;

const HighlightPopup = ({ comment }) =>
    comment.text ? (
        <div className="Highlight__popup">
            {comment.emoji} {comment.text}
        </div>
    ) : null;

class PdfAnnotation extends React.Component {
    /*
     * A single annotation
     */
    constructor(props) {
        super(props)
    }

    showTip = (popUpContent) => {
        const { highlight } = this.props

        // this.props.showTip(highlight);
    }

    hideTip = () => {
        // hide the tooltip for this annotation
        this.props.hideTip();
    }

    render() {
        const { highlight } = this.props

        const scaledPosition = this.props.scaledPositionToViewport(highlight.position)
        const highlightWithScaledPos = { ...highlight, position: scaledPosition }

        // TODO: should not happen here - 2018-04-24
        // if (tip && tip.highlight.id === String(highlight.id)) {
        //     // should highlight the annotation
        //     this.showTip(tip.highlight, tip.callback(viewportHighlight));
        // }

        // const isScrolledTo = Boolean(
        //     scrolledToHighlightId === highlight.id
        // );

        const isTextHighlight = !Boolean(
            highlight.content && highlight.content.image
        );

        const component = isTextHighlight ? (
            <Highlight
                isScrolledTo={false}
                position={scaledPosition}
                comment={highlight.comment}
            />
        ) : (
            <AreaHighlight
                highlight={highlightWithScaledPos}
                onChange={boundingRect => {
                    // when resizing, should update the highlight
                    this.updateHighlight(
                        highlight.id,
                        { boundingRect: this.props.viewportToScaled(boundingRect, this.props.pageNumber) },
                        { image: this.props.screenshot(boundingRect) }
                    );
                }}
            />
        );

        // TODO: Don't render this for every popup. Instead, have one component and move it around. - 2018-04-24
        return (
            <Popup
                popupContent={<HighlightPopup {...highlight} />}
                onMouseOver={this.showTip}
                onMouseOut={this.hideTip}
                children={component}
            />
        );
    }
}

class PdfAnnotationLayerPage extends React.Component {
    /*
     * An annotation layer overlay for a given PDF page
     */
    constructor(props) {
        super(props)
    }

    screenshot = (rect) => {
        const { pageNumber } = this.props

        return this.props.screenshot(rect, pageNumber)
    }

    render() {
        const { highlights, pageNumber } = this.props

        return (
            <div className="PdfAnnotator__highlight-layer">
                {(highlights).map(
                    (highlight, index) => {
                        return (
                            <PdfAnnotation 
                                key={index} 
                                highlight={highlight}
                                pageNumber={pageNumber}
                                viewportToScaled={this.props.viewportToScaled}
                                scaledPositionToViewport={this.props.scaledPositionToViewport}
                                screenshot={this.screenshot}
                            />
                        )
                    }
                )}
            </div>
        )
    }
}

class PdfAnnotationLayer extends React.Component {
    /*
     * This annotation layer is rendered as a portal over the pdfjs textlayer div.
     * must be rendered separately for every page in the pdf
     * // TODO: don't render all at once, only once that are in the view - 2018-04-24
     */
    constructor(props) {
        super(props)
    }

    groupHighlightsByPage(highlights) {
        // TODO: what is this? - 2018-04-24
        // const { ghostHighlight } = this.props;

        return highlights
            .filter(Boolean)
            .reduce((acc, highlight) => {
                const { pageNumber } = highlight.position;

                acc[pageNumber] = acc[pageNumber] || [];
                acc[pageNumber].push(highlight);

                return acc;
            }, {});
    }

    render() {
        const {
            pdfDocument,
            pdfViewer,
            highlights,
        } = this.props

        if (!pdfViewer) {
            return null;
        }

        const highlightsByPage = this.groupHighlightsByPage(highlights);

        return _.range(1, pdfDocument.numPages).map((pageNumber, index) => {

            const textLayer = pdfViewer.getPageView(pageNumber - 1).textLayer;

            if (!textLayer) {
                return null;
            }

            return ReactDOM.createPortal(
                <PdfAnnotationLayerPage
                    key={index}
                    pdfViewer={pdfViewer}
                    highlights={highlightsByPage[String(pageNumber)] || []}
                    viewportToScaled={this.props.viewportToScaled}
                    scaledPositionToViewport={this.props.scaledPositionToViewport}
                />
                , textLayer.textLayerDiv
            )
        })
    }
}

class PdfAnnotator extends React.Component {
    /*
     * Wraps a pdf document with annotation capabilities
     * This adds two layers over the document:
     * - A tooltip layer: for showing the tooltip
     * - An annotation layer: for overlaying the annotations over the document
     * 
     * Possible improvements:
     * - don't render all highlights simultaneously but just the ones that are visible (within range)
     * - Add react-virtualized for the annotation layer (https://www.youtube.com/watch?v=aV1271hd9ew)
     */
    state = {
        scrolledToHighlightId: null,
    };


    viewportToScaled = (rect, pageNumber) => {
        const viewport = this.pdfViewer.getPageView(pageNumber - 1).viewport;

        return viewportToScaled(rect, viewport);
    }

    scaledPositionToViewport = ({
        pageNumber,
        boundingRect,
        rects,
        usePdfCoordinates
    }: T_ScaledPosition): T_Position => {
        const viewport = this.pdfViewer.getPageView(pageNumber - 1).viewport;

        return {
            boundingRect: scaledToViewport(boundingRect, viewport, usePdfCoordinates),
            rects: (rects || []).map(rect =>
                scaledToViewport(rect, viewport, usePdfCoordinates)
            ),
            pageNumber
        };
    }

    viewportPositionToScaled = ({
        pageNumber,
        boundingRect,
        rects
    }: T_Position): T_ScaledPosition => {
        const viewport = this.pdfViewer.getPageView(pageNumber - 1).viewport;

        return {
            boundingRect: viewportToScaled(boundingRect, viewport),
            rects: (rects || []).map(rect => viewportToScaled(rect, viewport)),
            pageNumber
        };
    }

    onDocumentReady = () => {
        /*
         * // TODO: desc - 2018-04-27 If an annotation is focused in the URL, scroll to that annotation
         */
    };

    onTextLayerRendered = () => {
        this.setState({ textLayerRendered: true })
    };

    addHighlight = (highlight) => {
        console.log("add the highlight", highlight)
    }

    removeHighlight = (highlight) => {
        console.log("remove the highlight", highlight)
    }

    componentDidMount() {
        const { pdfDocument } = this.props;

        this.linkService = new PDFJS.PDFLinkService();

        this.pdfViewer = new PDFJS.PDFViewer({
            container: this.containerNode,
            enhanceTextSelection: true,
            removePageBorders: true,
            linkService: this.linkService
        });

        this.pdfViewer.setDocument(pdfDocument);
        this.linkService.setDocument(pdfDocument);

        this.containerNode.addEventListener("pagesinit", this.onDocumentReady);
        this.containerNode.addEventListener("textlayerrendered", this.onTextLayerRendered);
    }

    componentWillUnmount() {
        this.containerNode.removeEventListener("pagesinit", this.onDocumentReady);
        this.containerNode.removeEventListener("textlayerrendered", this.onTextLayerRendered);
    }

    render() {
        const {  } = this.props;
        const { textLayerRendered } = this.state;

        return (
            <div
                ref={node => (this.containerNode = node)}
                className="PdfAnnotator"
            >
                <div className="pdfViewer" />
                {
                    textLayerRendered ?
                        <React.Fragment>
                            <PdfAnnotationLayer
                                pdfDocument={this.props.pdfDocument}
                                pdfViewer={this.pdfViewer}
                                highlights={this.props.highlights}
                                viewportToScaled={this.viewportToScaled}
                                scaledPositionToViewport={this.scaledPositionToViewport}
                            />
                            <PdfAnnotationTooltip />
                            <PdfAreaSelection
                                pdfViewer={this.pdfViewer}
                                viewportPositionToScaled={this.viewportPositionToScaled}
                                addHighlight={this.addHighlight}
                            />
                            <PdfTextSelection 
                                containerNode={this.containerNode} 
                                pdfViewer={this.pdfViewer}
                                viewportPositionToScaled={this.viewportPositionToScaled}
                                addHighlight={this.addHighlight}
                            />
                        </React.Fragment>
                        : null
                }

            </div>
        )
}
}

export default PdfAnnotator
