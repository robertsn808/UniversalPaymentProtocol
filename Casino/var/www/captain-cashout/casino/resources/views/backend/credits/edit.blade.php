@extends('backend.layouts.app')

@section('page-title', trans('app.edit_credit'))
@section('page-heading', $credit->credit)

@section('content')
<section class="content-header">
	@include('backend.partials.messages')
</section>
<section class="content">
	<form action="{{ route('backend.credit.update', $credit->id) }}" method="POST" enctype="multipart/form-data" id="user-form">
		@csrf
		<div class="box box-default">
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.credit_details')</h3>
			</div>
			<div class="box-body">
				<div class="row">
					@include('backend.credits.partials.base', ['edit' => true])
				</div>
			</div>
			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_credit')
				</button>
				<a href="{{ route('backend.credit.delete', $credit->id) }}" class="btn btn-danger" data-method="DELETE" data-confirm-title="@lang('app.please_confirm')" data-confirm-text="@lang('app.are_you_sure_delete_credit')" data-confirm-delete="@lang('app.yes_delete_him')">
					@lang('app.delete_credit')
				</a>
			</div>
		</div>
	</form>
</section>
@stop

@section('scripts')
@stop