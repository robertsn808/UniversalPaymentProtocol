@extends('backend.layouts.app')

@section('page-title', trans('app.add_refund'))
@section('page-heading', trans('app.add_refund'))

@section('content')

<div class="row wow fadeIn">
	<div class="col-lg-12">
		<section class="content-header">
			@include('backend.partials.messages')
		</section>
		<div class="element-wrapper">
			<div class="element-box">
				<div class="element-info mb-3">
					<div class="element-info-with-icon">
						<div class="element-info-icon">
							<div class="fa fa-pie-chart"></div>
						</div>
						<div class="element-info-text">
							<h5 class="element-inner-header">@lang('app.add_refund')</h5>
							<div class="element-inner-desc text-primary">
							</div>
						</div>
					</div>
				</div>
				<section class="content">
					<div class="box box-default">
						<form action="{{ route('backend.refunds.store') }}" method="POST" enctype="multipart/form-data" id="refund-form">
							@csrf


							<div class="box-body">
								<div class="row">
									@include('backend.refunds.partials.base', ['edit' => false, 'profile' => false])
								</div>
							</div>

							<div class="box-footer">
								<button type="submit" class="btn btn-primary">
									@lang('app.add_refund')
								</button>
							</div>
						</form>
					</div>
				</section>
			</div>
		</div>
	</div>
</div>





@stop